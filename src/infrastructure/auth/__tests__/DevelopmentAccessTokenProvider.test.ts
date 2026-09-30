import { DevelopmentAccessTokenProvider } from '../DevelopmentAccessTokenProvider';
import { HttpTransport } from '../../http/HttpTransport';
import type { HttpFetch, HttpResponse } from '../../http/HttpTransport';

describe('DevelopmentAccessTokenProvider', () => {
  it('provides a development credential and the transport uses it only in Authorization', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    } satisfies HttpResponse) as jest.MockedFunction<HttpFetch>;
    const provider = new DevelopmentAccessTokenProvider();
    const transport = new HttpTransport({ baseUrl: 'https://development.invalid', accessTokenProvider: provider, fetchImplementation });
    await transport.request({ method: 'GET', path: '/profile', authenticated: true });
    expect(fetchImplementation.mock.calls[0]?.[1].headers.Authorization).toBe('Bearer development-api-access-token');
    expect(fetchImplementation.mock.calls[0]?.[1].body).toBeUndefined();
  });
});
