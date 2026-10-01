import { HttpError } from '../../http/HttpError';
import { HttpTransport, type HttpFetch, type HttpResponse } from '../../http/HttpTransport';
import { CalendarApi } from '../CalendarApi';

const entryDto = {
  id: 'entry-123',
  startAt: '2026-10-05T07:00:00Z',
  endAt: '2026-10-05T10:00:00Z',
  type: 'external_order',
  status: 'scheduled',
  title: 'Cleaning',
};

function setup(status = 200, body: unknown = { entries: [entryDto] }) {
  const json = jest.fn().mockResolvedValue(body);
  const response: HttpResponse = { status, json };
  const fetchImplementation = jest.fn().mockResolvedValue(response) as jest.MockedFunction<HttpFetch>;
  const api = new CalendarApi(new HttpTransport({
    baseUrl: 'https://api.example',
    fetchImplementation,
  }));

  return { api, fetchImplementation, json };
}

describe('CalendarApi', () => {
  it('gets entries with encoded from and to query parameters', async () => {
    const { api, fetchImplementation } = setup();

    await expect(api.getEntries('2026-10-05T00:00:00Z', '2026-10-06T00:00:00Z'))
      .resolves.toEqual({ entries: [entryDto] });
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example/v1/me/calendar/entries?from=2026-10-05T00%3A00%3A00Z&to=2026-10-06T00%3A00%3A00Z',
      { method: 'GET', headers: { Accept: 'application/json' } },
    );
  });

  it('gets one encoded entry by id', async () => {
    const { api, fetchImplementation } = setup(200, entryDto);

    await expect(api.getEntry('entry/123')).resolves.toEqual(entryDto);
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example/v1/me/calendar/entries/entry%2F123',
      { method: 'GET', headers: { Accept: 'application/json' } },
    );
  });

  it('posts only the create request fields', async () => {
    const { api, fetchImplementation } = setup(201, entryDto);
    const body = {
      startAt: '2026-10-05T07:00:00Z',
      endAt: '2026-10-05T10:00:00Z',
      type: 'blocked',
      title: 'Unavailable',
    };

    await expect(api.createEntry(body)).resolves.toEqual(entryDto);
    expect(fetchImplementation).toHaveBeenCalledWith('https://api.example/v1/me/calendar/entries', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });

  it('patches an encoded entry path with only the update fields', async () => {
    const { api, fetchImplementation } = setup(200, entryDto);
    const body = { title: '' };

    await expect(api.updateEntry('entry/123', body)).resolves.toEqual(entryDto);
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example/v1/me/calendar/entries/entry%2F123',
      {
        method: 'PATCH',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: '{"title":""}',
      },
    );
  });

  it('deletes an entry and handles 204 without parsing a body', async () => {
    const { api, fetchImplementation, json } = setup(204, undefined);

    await expect(api.deleteEntry('entry-123')).resolves.toBeUndefined();
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example/v1/me/calendar/entries/entry-123',
      { method: 'DELETE', headers: { Accept: 'application/json' } },
    );
    expect(json).not.toHaveBeenCalled();
  });

  it.each([[404, 'NotFound'], [409, 'Conflict']] as const)(
    'passes HTTP %i through as a safe %s error',
    async (status, code) => {
      const { api, json } = setup(status, { error: { code: 'private backend detail' } });

      await expect(api.updateEntry('entry-123', { title: 'Changed' }))
        .rejects.toEqual(new HttpError(code));
      expect(json).not.toHaveBeenCalled();
    },
  );
});
