import { ProfileApi } from '../ProfileApi';
import { ProfileApiRepository } from '../ProfileApiRepository';
import { HttpTransport, type HttpFetch, type HttpResponse } from '../../http/HttpTransport';
import { HttpError } from '../../http/HttpError';

const profile = {
  userId: 'user-1', displayName: 'Alex', phone: null, email: null, avatar: null, locale: null, country: null,
};

function setup(status = 200, body: unknown = { profile }) {
  const fetchImplementation = jest.fn().mockResolvedValue({ status, json: async () => body } satisfies HttpResponse) as jest.MockedFunction<HttpFetch>;
  const api = new ProfileApi(new HttpTransport({ baseUrl: 'https://api.example', fetchImplementation }));
  return { repository: new ProfileApiRepository(api), fetchImplementation };
}

describe('ProfileApiRepository', () => {
  it('loads and maps GET /v1/me/profile without putting userId in the request', async () => {
    const { repository, fetchImplementation } = setup();
    await expect(repository.getProfile('user-1')).resolves.toEqual(profile);
    expect(fetchImplementation).toHaveBeenCalledWith('https://api.example/v1/me/profile', {
      method: 'GET', headers: { Accept: 'application/json' },
    });
  });

  it('updates through PATCH /v1/me/profile with only displayName and maps the full response', async () => {
    const { repository, fetchImplementation } = setup();
    await expect(repository.updateDisplayName('user-1', 'Alex')).resolves.toEqual(profile);
    expect(fetchImplementation).toHaveBeenCalledWith('https://api.example/v1/me/profile', {
      method: 'PATCH', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{"displayName":"Alex"}',
    });
  });

  it('maps 404 to null and maps other HTTP statuses to safe repository errors', async () => {
    await expect(setup(404).repository.getProfile('user-1')).resolves.toBeNull();
    const cases = [[400, 'ValidationError'], [401, 'Unauthorized'], [403, 'Forbidden'], [500, 'ServerError']] as const;
    for (const [status, code] of cases) {
      await expect(setup(status).repository.getProfile('user-1')).rejects.toMatchObject({ code });
    }
  });

  it('rejects a response for an identity other than the requested user', async () => {
    const { repository } = setup(200, { profile: { ...profile, userId: 'other-user' } });
    await expect(repository.getProfile('user-1')).rejects.toMatchObject({ code: 'UnexpectedResponse' });
  });

  it('does not propagate transport errors or backend body details', async () => {
    const fetchImplementation: HttpFetch = async () => { throw new HttpError('NetworkError'); };
    const repository = new ProfileApiRepository(new ProfileApi(new HttpTransport({ baseUrl: 'https://api.example', fetchImplementation })));
    await expect(repository.getProfile('user-1')).rejects.toEqual({ code: 'NetworkError' });
  });
});
