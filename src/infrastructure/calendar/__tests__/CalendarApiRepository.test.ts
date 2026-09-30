import type { CalendarEntry } from '../../../domain/calendar/entities/CalendarEntry';
import type { CalendarRepository } from '../../../domain/calendar/repositories/CalendarRepository';
import { HttpError } from '../../http/HttpError';
import { CalendarApi } from '../CalendarApi';
import { CalendarApiRepository } from '../CalendarApiRepository';

const entryDto = {
  id: 'entry-123',
  startAt: '2026-10-05T07:00:00Z',
  endAt: '2026-10-05T10:00:00Z',
  type: 'external_order',
  status: 'scheduled',
  title: 'Cleaning',
};

const entry: CalendarEntry = { ...entryDto, type: 'external_order', status: 'scheduled' };

function createApi() {
  const api = {
    getEntries: jest.fn().mockResolvedValue({ entries: [entryDto] }),
    createEntry: jest.fn().mockResolvedValue(entryDto),
    updateEntry: jest.fn().mockResolvedValue(entryDto),
    deleteEntry: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<CalendarApi>;
  return api;
}

describe('CalendarApiRepository', () => {
  it('implements CalendarRepository and maps list DTOs to domain entries', async () => {
    const api = createApi();
    const repository: CalendarRepository = new CalendarApiRepository(api);
    const result = await repository.getEntries('2026-10-05T00:00:00Z', '2026-10-06T00:00:00Z');

    expect(api.getEntries).toHaveBeenCalledWith('2026-10-05T00:00:00Z', '2026-10-06T00:00:00Z');
    expect(result).toEqual([entry]);
    expect(result[0]).not.toBe(entryDto);
  });

  it('maps create input to the permitted DTO and maps the response to a domain entry', async () => {
    const api = createApi();
    const repository = new CalendarApiRepository(api);
    const input = {
      startAt: entry.startAt,
      endAt: entry.endAt,
      type: 'blocked' as const,
      title: 'Unavailable',
    };

    await expect(repository.createEntry(input)).resolves.toEqual(entry);
    expect(api.createEntry).toHaveBeenCalledWith(input);
    expect(Object.keys(api.createEntry.mock.calls[0][0]).sort())
      .toEqual(['endAt', 'startAt', 'title', 'type']);
  });

  it('maps update changes including an empty title without adding protected fields', async () => {
    const api = createApi();
    const repository = new CalendarApiRepository(api);
    const changes = { title: '' };

    await expect(repository.updateEntry('entry-123', changes)).resolves.toEqual(entry);
    expect(api.updateEntry).toHaveBeenCalledWith('entry-123', changes);
    expect(Object.keys(api.updateEntry.mock.calls[0][1])).toEqual(['title']);
  });

  it('delegates delete and returns no DTO or response data', async () => {
    const api = createApi();
    const repository = new CalendarApiRepository(api);

    await expect(repository.deleteEntry('entry-123')).resolves.toBeUndefined();
    expect(api.deleteEntry).toHaveBeenCalledWith('entry-123');
  });

  it.each([
    ['getEntries', 'BadRequest', 'ValidationError'],
    ['createEntry', 'Unauthorized', 'Unauthorized'],
    ['createEntry', 'Forbidden', 'Forbidden'],
    ['updateEntry', 'NotFound', 'EntryNotFound'],
    ['deleteEntry', 'NotFound', 'EntryNotFound'],
    ['updateEntry', 'Conflict', 'CalendarConflict'],
    ['createEntry', 'ServerError', 'ServerError'],
  ] as const)('maps %s HTTP errors %s to %s', async (operation, httpCode, expectedCode) => {
    const api = createApi();
    const error = new HttpError(httpCode);
    if (operation === 'getEntries') {
      api.getEntries.mockRejectedValueOnce(error);
      await expect(new CalendarApiRepository(api).getEntries('from', 'to'))
        .rejects.toEqual({ code: expectedCode });
    } else if (operation === 'createEntry') {
      api.createEntry.mockRejectedValueOnce(error);
      await expect(new CalendarApiRepository(api).createEntry({
        startAt: entry.startAt,
        endAt: entry.endAt,
        type: 'blocked',
        title: 'Unavailable',
      })).rejects.toEqual({ code: expectedCode });
    } else if (operation === 'updateEntry') {
      api.updateEntry.mockRejectedValueOnce(error);
      await expect(new CalendarApiRepository(api).updateEntry('entry-123', {}))
        .rejects.toEqual({ code: expectedCode });
    } else {
      api.deleteEntry.mockRejectedValueOnce(error);
      await expect(new CalendarApiRepository(api).deleteEntry('entry-123'))
        .rejects.toEqual({ code: expectedCode });
    }
  });

  it('treats a list 404 as an unexpected response, since an empty list is successful', async () => {
    const api = createApi();
    api.getEntries.mockRejectedValueOnce(new HttpError('NotFound'));

    await expect(new CalendarApiRepository(api).getEntries('from', 'to'))
      .rejects.toEqual({ code: 'UnexpectedResponse' });
  });

  it('converts malformed API entries to a safe error without returning DTOs', async () => {
    const api = createApi();
    api.getEntries.mockResolvedValueOnce({ entries: [{ ...entryDto, type: 'other' }] });

    await expect(new CalendarApiRepository(api).getEntries('from', 'to'))
      .rejects.toEqual({ code: 'UnexpectedResponse' });
  });
});
