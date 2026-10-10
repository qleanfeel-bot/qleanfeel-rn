import type { ProviderCredential } from '../../../application/auth/ProviderCredential';
import { HttpTransport, type HttpFetch } from '../../http/HttpTransport';
import { HttpError } from '../../http/HttpError';
import { HttpSessionApi } from '../HttpSessionApi';

const response = {
  user: {
    id: 'user-1',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  session: { id: 'session-1', expiresAt: '2026-02-01T00:00:00.000Z' },
  accessToken: 'synthetic-access',
  refreshToken: 'synthetic-refresh',
  tokenType: 'Bearer',
};

describe('HttpSessionApi', () => {
  it('sends provider proof only to bootstrap and maps Qleanfeel credentials', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => response,
    }) as jest.MockedFunction<HttpFetch>;
    const api = new HttpSessionApi(
      new HttpTransport({
        baseUrl: 'https://api.example',
        fetchImplementation,
      }),
    );

    await expect(
      api.bootstrap('provider-proof' as ProviderCredential),
    ).resolves.toEqual({
      user: {
        id: 'user-1',
        status: 'active',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      accessToken: 'synthetic-access',
      refreshToken: 'synthetic-refresh',
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example/v1/auth/bootstrap',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: '{"firebaseIdToken":"provider-proof"}',
      },
    );
  });

  it('sends refresh without protected-request retry and logout with the current Bearer token', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValueOnce({ status: 200, json: async () => response })
      .mockResolvedValueOnce({
        status: 204,
        json: async () => {
          throw new Error('no body');
        },
      }) as jest.MockedFunction<HttpFetch>;
    const api = new HttpSessionApi(
      new HttpTransport({
        baseUrl: 'https://api.example',
        fetchImplementation,
      }),
    );

    await api.refresh('refresh-current');
    await api.logout('access-current');
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      'https://api.example/v1/auth/refresh',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: '{"refreshToken":"refresh-current"}',
      },
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      'https://api.example/v1/auth/logout',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer access-current',
        },
      },
    );
  });

  it('rejects malformed credential responses without retaining their contents', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ...response, accessToken: '' }),
    }) as jest.MockedFunction<HttpFetch>;
    const api = new HttpSessionApi(
      new HttpTransport({
        baseUrl: 'https://api.example',
        fetchImplementation,
      }),
    );

    await expect(
      api.bootstrap('provider-proof' as ProviderCredential),
    ).rejects.toEqual(new HttpError('UnexpectedResponse'));
  });
});
