import type { CalendarEntry } from '../../../domain/calendar/entities/CalendarEntry';
import {
  calendarEntriesFromDto,
  calendarEntryCreateRequestFromInput,
  calendarEntryFromDto,
  calendarEntryUpdateRequestFromChanges,
} from '../calendarMappers';

const entryDto = {
  id: 'entry-123',
  startAt: '2026-10-05T07:00:00Z',
  endAt: '2026-10-05T10:00:00Z',
  type: 'external_order',
  status: 'scheduled',
  title: 'Cleaning',
};

const entry: CalendarEntry = { ...entryDto, type: 'external_order', status: 'scheduled' };

describe('calendar mappers', () => {
  it('maps a response DTO into a domain CalendarEntry', () => {
    const result = calendarEntryFromDto(entryDto);

    expect(result).toEqual(entry);
    expect(result).not.toBe(entryDto);
  });

  it('maps list response DTOs and preserves an empty list', () => {
    expect(calendarEntriesFromDto({ entries: [entryDto] })).toEqual([entry]);
    expect(calendarEntriesFromDto({ entries: [] })).toEqual([]);
  });

  it('maps malformed response data to the safe unexpected-response error', () => {
    expect(() => calendarEntriesFromDto({ entries: [{ ...entryDto, status: 'pending' }] }))
      .toThrow();
    expect(() => calendarEntriesFromDto({ entries: null })).toThrow();
  });

  it('maps create input to only the permitted request fields', () => {
    const request = calendarEntryCreateRequestFromInput({
      startAt: entry.startAt,
      endAt: entry.endAt,
      type: entry.type,
      title: entry.title,
    });

    expect(request).toEqual({
      startAt: entry.startAt,
      endAt: entry.endAt,
      type: entry.type,
      title: entry.title,
    });
    expect(Object.keys(request).sort()).toEqual(['endAt', 'startAt', 'title', 'type']);
  });

  it('maps only permitted update fields and preserves an empty title', () => {
    const request = calendarEntryUpdateRequestFromChanges({
      startAt: '2026-10-05T08:00:00Z',
      title: '',
    });

    expect(request).toEqual({ startAt: '2026-10-05T08:00:00Z', title: '' });
    expect(Object.keys(request).sort()).toEqual(['startAt', 'title']);
  });
});
