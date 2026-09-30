import {
  CALENDAR_ENTRY_STATUSES,
  CALENDAR_ENTRY_TYPES,
  createCalendarEntry,
  type CalendarEntry,
} from '../CalendarEntry';

const validEntry: CalendarEntry = {
  id: 'entry-1',
  startAt: '2026-10-05T07:00:00Z',
  endAt: '2026-10-05T10:00:00Z',
  type: 'blocked',
  status: 'scheduled',
  title: 'Unavailable',
};

describe('CalendarEntry', () => {
  it('creates a valid CalendarEntry', () => {
    expect(createCalendarEntry(validEntry)).toEqual(validEntry);
  });

  it.each(Object.values(CALENDAR_ENTRY_TYPES))('accepts type %s', type => {
    expect(createCalendarEntry({ ...validEntry, type }).type).toBe(type);
  });

  it.each(Object.values(CALENDAR_ENTRY_STATUSES))('accepts status %s', status => {
    expect(createCalendarEntry({ ...validEntry, status }).status).toBe(status);
  });

  it('accepts ISO-8601 UTC values with fractional seconds', () => {
    expect(createCalendarEntry({
      ...validEntry,
      startAt: '2026-10-05T07:00:00.125Z',
      endAt: '2026-10-05T07:00:00.126Z',
    })).toMatchObject({
      startAt: '2026-10-05T07:00:00.125Z',
      endAt: '2026-10-05T07:00:00.126Z',
    });
  });

  it('requires startAt to be before endAt', () => {
    expect(createCalendarEntry(validEntry)).toEqual(validEntry);
    expect(() => createCalendarEntry({
      ...validEntry,
      startAt: '2026-10-05T07:00:00.0002Z',
      endAt: '2026-10-05T07:00:00.0001Z',
    })).toThrow('Invalid CalendarEntry');
  });

  it.each([
    ['equal instants', '2026-10-05T07:00:00Z', '2026-10-05T07:00:00.000Z'],
    ['reversed instants', '2026-10-05T08:00:00Z', '2026-10-05T07:00:00Z'],
  ])('rejects %s', (_description, startAt, endAt) => {
    expect(() => createCalendarEntry({ ...validEntry, startAt, endAt })).toThrow(
      'Invalid CalendarEntry',
    );
  });

  it('rejects an unsupported type', () => {
    expect(() => createCalendarEntry({ ...validEntry, type: 'other' })).toThrow(
      'Invalid CalendarEntry',
    );
  });

  it('rejects an unsupported status', () => {
    expect(() => createCalendarEntry({ ...validEntry, status: 'pending' })).toThrow(
      'Invalid CalendarEntry',
    );
  });

  it.each([
    'not-a-date',
    '2026-02-30T07:00:00Z',
    '2026-10-05T07:00:00+00:00',
    '2026-10-05T07:00:00',
  ])('rejects malformed or non-UTC time %s', startAt => {
    expect(() => createCalendarEntry({ ...validEntry, startAt })).toThrow(
      'Invalid CalendarEntry',
    );
  });
});
