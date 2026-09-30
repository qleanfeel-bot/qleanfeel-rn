import type { AccessTokenProvider } from '../../../application/auth/ports/AccessTokenProvider';
import { HttpError } from '../HttpError';
import { HttpTransport, type HttpFetch, type HttpResponse } from '../HttpTransport';

function makeResponse(status: number, body: unknown): HttpResponse {
  return { status, json: async () => body };
}

describe('HttpTransport', () => {
  const tokenProvider: AccessTokenProvider = { getAccessToken: async () => 'secret-test-token' };

  it('sends GET, parses JSON, and adds bearer authorization for authenticated requests', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(makeResponse(200, { ok: true })) as jest.MockedFunction<HttpFetch>;
    const transport = new HttpTransport({ baseUrl: 'https://api.example', accessTokenProvider: tokenProvider, fetchImplementation });
    await expect(transport.request({ method: 'GET', path: '/v1/me/profile', authenticated: true })).resolves.toEqual({ ok: true });
    expect(fetchImplementation).toHaveBeenCalledWith('https://api.example/v1/me/profile', {
      method: 'GET', headers: { Accept: 'application/json', Authorization: 'Bearer secret-test-token' },
    });
  });

  it('sends PATCH JSON and omits authorization when no token exists', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(makeResponse(200, { saved: true })) as jest.MockedFunction<HttpFetch>;
    const transport = new HttpTransport({
      baseUrl: 'https://api.example',
      accessTokenProvider: { getAccessToken: async () => null },
      fetchImplementation,
    });
    await transport.request({ method: 'PATCH', path: '/v1/me/profile', body: { displayName: 'Alex' }, authenticated: true });
    expect(fetchImplementation).toHaveBeenCalledWith('https://api.example/v1/me/profile', {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{"displayName":"Alex"}',
    });
  });

  it.each([[400, 'BadRequest'], [401, 'Unauthorized'], [403, 'Forbidden'], [404, 'NotFound'], [500, 'ServerError']] as const)(
    'maps HTTP %i to safe %s error without reading the response body',
    async (status, code) => {
      const errorResponse: HttpResponse = { status, json: jest.fn().mockResolvedValue({ error: { message: 'private backend detail' } }) };
      const fetchImplementation = jest.fn().mockResolvedValue(errorResponse) as jest.MockedFunction<HttpFetch>;
      const transport = new HttpTransport({ baseUrl: 'https://api.example', fetchImplementation });
      await expect(transport.request({ method: 'GET', path: '/resource' })).rejects.toMatchObject({ code });
      expect(errorResponse.json).not.toHaveBeenCalled();
    },
  );

  it('converts network failures to a safe error without exposing the original message', async () => {
    const fetchImplementation = jest.fn().mockRejectedValue(new Error('private network detail')) as jest.MockedFunction<HttpFetch>;
    const transport = new HttpTransport({ baseUrl: 'https://api.example', fetchImplementation });
    try {
      await transport.request({ method: 'GET', path: '/resource' });
      throw new Error('expected request failure');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ code: 'NetworkError', message: 'NetworkError' });
      expect(String(error)).not.toContain('private network detail');
    }
  });

  it('normalizes access-token provider failures without exposing provider details or credentials', async () => {
    const token = 'private-access-token';
    const credential = 'private-provider-credential';
    const originalError = new Error(`provider stack details: ${token} ${credential}`);
    const getAccessToken = jest.fn().mockRejectedValue(originalError);
    const fetchImplementation = jest.fn().mockResolvedValue(makeResponse(200, { ok: true })) as jest.MockedFunction<HttpFetch>;
    const transport = new HttpTransport({
      baseUrl: 'https://api.example',
      accessTokenProvider: { getAccessToken },
      fetchImplementation,
    });

    try {
      await transport.request({ method: 'GET', path: '/v1/me/profile', authenticated: true });
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
});
