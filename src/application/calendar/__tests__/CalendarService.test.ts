import type { CalendarEntry } from '../../../domain/calendar/entities/CalendarEntry';
import type { CalendarRepository } from '../../../domain/calendar/repositories/CalendarRepository';
import { CalendarService } from '../CalendarService';

const entry: CalendarEntry = {
  id: 'entry-1',
  startAt: '2026-10-05T07:00:00Z',
  endAt: '2026-10-05T10:00:00Z',
  type: 'blocked',
  status: 'scheduled',
  title: 'Unavailable',
};

function createRepository() {
  const entries = [entry];
  const repository: jest.Mocked<CalendarRepository> = {
    getEntries: jest.fn().mockResolvedValue(entries),
    getEntry: jest.fn().mockResolvedValue(entry),
    createEntry: jest.fn().mockResolvedValue(entry),
    updateEntry: jest.fn().mockResolvedValue(entry),
    deleteEntry: jest.fn().mockResolvedValue(undefined),
  };

  return { repository, entries };
}

describe('CalendarService', () => {
  it('passes the requested range to the repository and returns its entries', async () => {
    const { repository, entries } = createRepository();
    const service = new CalendarService(repository);

    await expect(service.getEntries('2026-10-05T00:00:00Z', '2026-10-06T00:00:00Z'))
      .resolves.toBe(entries);
    expect(repository.getEntries).toHaveBeenCalledTimes(1);
    expect(repository.getEntries).toHaveBeenCalledWith(
      '2026-10-05T00:00:00Z',
      '2026-10-06T00:00:00Z',
    );
  });

  it('passes an entry id to the repository read-by-id operation', async () => {
    const { repository } = createRepository();
    const service = new CalendarService(repository);

    await expect(service.getEntry(entry.id)).resolves.toBe(entry);
    expect(repository.getEntry).toHaveBeenCalledWith(entry.id);
  });

  it('passes the create input to the repository and returns its entry', async () => {
    const { repository } = createRepository();
    const service = new CalendarService(repository);
    const input = {
      startAt: entry.startAt,
      endAt: entry.endAt,
      type: entry.type,
      title: entry.title,
    };

    await expect(service.createEntry(input)).resolves.toBe(entry);
    expect(repository.createEntry).toHaveBeenCalledTimes(1);
    expect(repository.createEntry).toHaveBeenCalledWith(input);
  });

  it('passes only the requested update changes to the repository and returns its entry', async () => {
    const { repository } = createRepository();
    const service = new CalendarService(repository);
    const changes = { startAt: '2026-10-05T08:00:00Z', title: '' };

    await expect(service.updateEntry(entry.id, changes)).resolves.toBe(entry);
    expect(repository.updateEntry).toHaveBeenCalledTimes(1);
    expect(repository.updateEntry).toHaveBeenCalledWith(entry.id, changes);
  });

  it('passes the entry id to delete and returns the repository result', async () => {
    const { repository } = createRepository();
    const service = new CalendarService(repository);

    await expect(service.deleteEntry(entry.id)).resolves.toBeUndefined();
    expect(repository.deleteEntry).toHaveBeenCalledTimes(1);
    expect(repository.deleteEntry).toHaveBeenCalledWith(entry.id);
  });

  it('propagates repository errors without replacing them or performing extra calls', async () => {
    const failure = new Error('repository failure');
    const { repository } = createRepository();
    repository.updateEntry.mockRejectedValueOnce(failure);
    const service = new CalendarService(repository);

    await expect(service.updateEntry(entry.id, {})).rejects.toBe(failure);
    expect(repository.getEntries).not.toHaveBeenCalled();
    expect(repository.createEntry).not.toHaveBeenCalled();
    expect(repository.deleteEntry).not.toHaveBeenCalled();
  });
});
