import type { AccessTokenProvider } from '../../../application/auth/ports/AccessTokenProvider';
import { HttpError } from '../HttpError';
import {
  HttpTransport,
  type HttpFetch,
  type HttpResponse,
} from '../HttpTransport';
import {
  createAuthHarness,
  sessionCredentials,
  testProviderCredential,
} from '../../../testing/authTestSupport';

function makeResponse(status: number, body: unknown): HttpResponse {
  return { status, json: async () => body };
}

describe('HttpTransport', () => {
  const tokenProvider: AccessTokenProvider = {
    getAccessToken: async () => 'secret-test-token',
  };

  it('sends GET, parses JSON, and adds bearer authorization for authenticated requests', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { ok: true }),
      ) as jest.MockedFunction<HttpFetch>;
    const transport = new HttpTransport({
      baseUrl: 'https://api.example',
      accessTokenProvider: tokenProvider,
      fetchImplementation,
    });
    await expect(
      transport.request({
        method: 'GET',
        path: '/v1/me/profile',
        authenticated: true,
      }),
    ).resolves.toEqual({ ok: true });
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example/v1/me/profile',
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer secret-test-token',
        },
      },
    );
  });

  it('blocks a protected request when no access token is available', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { saved: true }),
      ) as jest.MockedFunction<HttpFetch>;
    const transport = new HttpTransport({
      baseUrl: 'https://api.example',
      accessTokenProvider: { getAccessToken: async () => null },
      fetchImplementation,
    });
    await expect(
      transport.request({
        method: 'PATCH',
        path: '/v1/me/profile',
        body: { displayName: 'Alex' },
        authenticated: true,
      }),
    ).rejects.toMatchObject({ code: 'AuthenticationRequired' });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('sends POST JSON', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(
        makeResponse(201, { created: true }),
      ) as jest.MockedFunction<HttpFetch>;
    const transport = new HttpTransport({
      baseUrl: 'https://api.example',
      accessTokenProvider: { getAccessToken: async () => 'test-access-token' },
      fetchImplementation,
    });

    await expect(
      transport.request({
        method: 'POST',
        path: '/v1/me/calendar/entries',
        body: { title: 'Unavailable' },
        authenticated: true,
      }),
    ).resolves.toEqual({ created: true });
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example/v1/me/calendar/entries',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token',
        },
        body: '{"title":"Unavailable"}',
      },
    );
  });

  it('accepts DELETE 204 No Content without attempting JSON parsing', async () => {
    const json = jest
      .fn()
      .mockRejectedValue(new Error('there is no response body'));
    const response: HttpResponse = { status: 204, json };
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(response) as jest.MockedFunction<HttpFetch>;
    const transport = new HttpTransport({
      baseUrl: 'https://api.example',
      fetchImplementation,
    });

    await expect(
      transport.request({
        method: 'DELETE',
        path: '/v1/me/calendar/entries/entry-1',
      }),
    ).resolves.toBeUndefined();
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example/v1/me/calendar/entries/entry-1',
      { method: 'DELETE', headers: { Accept: 'application/json' } },
    );
    expect(json).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'BadRequest'],
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
    [404, 'NotFound'],
    [409, 'Conflict'],
    [500, 'ServerError'],
  ] as const)(
    'maps HTTP %i to safe %s error without reading the response body',
    async (status, code) => {
      const errorResponse: HttpResponse = {
        status,
        json: jest
          .fn()
          .mockResolvedValue({ error: { message: 'private backend detail' } }),
      };
      const fetchImplementation = jest
        .fn()
        .mockResolvedValue(errorResponse) as jest.MockedFunction<HttpFetch>;
      const transport = new HttpTransport({
        baseUrl: 'https://api.example',
        fetchImplementation,
      });
      await expect(
        transport.request({ method: 'GET', path: '/resource' }),
      ).rejects.toMatchObject({ code });
      expect(errorResponse.json).not.toHaveBeenCalled();
    },
  );

  it('converts network failures to a safe error without exposing the original message', async () => {
    const fetchImplementation = jest
      .fn()
      .mockRejectedValue(
        new Error('private network detail'),
      ) as jest.MockedFunction<HttpFetch>;
    const transport = new HttpTransport({
      baseUrl: 'https://api.example',
      fetchImplementation,
    });
    try {
      await transport.request({ method: 'GET', path: '/resource' });
      throw new Error('expected request failure');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({
        code: 'NetworkError',
        message: 'NetworkError',
      });
      expect(String(error)).not.toContain('private network detail');
    }
  });

  it('normalizes access-token provider failures without exposing provider details or credentials', async () => {
    const token = 'private-access-token';
    const credential = 'private-provider-credential';
    const originalError = new Error(
      `provider stack details: ${token} ${credential}`,
    );
    const getAccessToken = jest.fn().mockRejectedValue(originalError);
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { ok: true }),
      ) as jest.MockedFunction<HttpFetch>;
    const transport = new HttpTransport({
      baseUrl: 'https://api.example',
      accessTokenProvider: { getAccessToken },
      fetchImplementation,
    });

    try {
      await transport.request({
        method: 'GET',
        path: '/v1/me/profile',
        authenticated: true,
      });
      throw new Error('expected token provider failure');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toEqual(new HttpError('UnexpectedResponse'));
      expect(error).not.toBe(originalError);
      expect(String(error)).not.toContain(originalError.message);
      expect(JSON.stringify(error)).not.toContain(token);
      expect(JSON.stringify(error)).not.toContain(credential);
      expect(fetchImplementation).not.toHaveBeenCalled();
    }
  });

  it('shares refresh after concurrent 401 responses and retries each request once', async () => {
    const { session, api } = createAuthHarness();
    await session.bootstrap(testProviderCredential);
    api.refresh.mockResolvedValue(sessionCredentials(undefined, '2'));
    const fetchImplementation = jest.fn(
      async (_url: string, init: Parameters<HttpFetch>[1]) => {
        const authorization = init.headers.Authorization;
        return authorization === 'Bearer test-access-1'
          ? makeResponse(401, {})
          : makeResponse(200, { authorization });
      },
    ) as jest.MockedFunction<HttpFetch>;
    const transport = new HttpTransport({
      baseUrl: 'https://api.example',
      accessTokenProvider: session,
      fetchImplementation,
    });

    const results = await Promise.all([
      transport.request({ method: 'GET', path: '/one', authenticated: true }),
      transport.request({ method: 'GET', path: '/two', authenticated: true }),
    ]);

    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(fetchImplementation).toHaveBeenCalledTimes(4);
    expect(results).toEqual([
      { authorization: 'Bearer test-access-2' },
      { authorization: 'Bearer test-access-2' },
    ]);
  });

  it('expires the session after the one allowed retry also receives 401', async () => {
    const { session, api, tokenStore } = createAuthHarness();
    await session.bootstrap(testProviderCredential);
    api.refresh.mockResolvedValue(sessionCredentials(undefined, '2'));
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(
        makeResponse(401, {}),
      ) as jest.MockedFunction<HttpFetch>;
    const transport = new HttpTransport({
      baseUrl: 'https://api.example',
      accessTokenProvider: session,
      fetchImplementation,
    });

    await expect(
      transport.request({
        method: 'GET',
        path: '/private',
        authenticated: true,
      }),
    ).rejects.toMatchObject({ code: 'Unauthorized' });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    await expect(session.getAccessToken()).resolves.toBeNull();
    expect(tokenStore.deleteRefreshToken).toHaveBeenCalled();
  });

  it.each([400, 403, 422, 500])(
    'does not refresh after HTTP %i',
    async status => {
      const { session, api } = createAuthHarness();
      await session.bootstrap(testProviderCredential);
      const fetchImplementation = jest
        .fn()
        .mockResolvedValue(
          makeResponse(status, {}),
        ) as jest.MockedFunction<HttpFetch>;
      const transport = new HttpTransport({
        baseUrl: 'https://api.example',
        accessTokenProvider: session,
        fetchImplementation,
      });

      await expect(
        transport.request({
          method: 'GET',
          path: '/private',
          authenticated: true,
        }),
      ).rejects.toBeInstanceOf(HttpError);
      expect(api.refresh).not.toHaveBeenCalled();
      expect(fetchImplementation).toHaveBeenCalledTimes(1);
    },
  );

  it('does not refresh public auth requests or network failures', async () => {
    const { session, api } = createAuthHarness();
    await session.bootstrap(testProviderCredential);
    const publicFetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(401, {}),
      ) as jest.MockedFunction<HttpFetch>;
    const publicTransport = new HttpTransport({
      baseUrl: 'https://api.example',
      accessTokenProvider: session,
      fetchImplementation: publicFetch,
    });
    await expect(
      publicTransport.request({ method: 'POST', path: '/v1/auth/refresh' }),
    ).rejects.toMatchObject({ code: 'Unauthorized' });
    expect(api.refresh).not.toHaveBeenCalled();

    const networkFetch = jest
      .fn()
      .mockRejectedValue(
        new Error('offline'),
      ) as jest.MockedFunction<HttpFetch>;
    const networkTransport = new HttpTransport({
      baseUrl: 'https://api.example',
      accessTokenProvider: session,
      fetchImplementation: networkFetch,
    });
    await expect(
      networkTransport.request({
        method: 'GET',
        path: '/private',
        authenticated: true,
      }),
    ).rejects.toMatchObject({ code: 'NetworkError' });
    expect(api.refresh).not.toHaveBeenCalled();
  });
});
