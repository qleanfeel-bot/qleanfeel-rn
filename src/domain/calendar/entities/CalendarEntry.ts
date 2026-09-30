export const CALENDAR_ENTRY_TYPES = {
  EXTERNAL_ORDER: 'external_order',
  BLOCKED: 'blocked',
  PERSONAL: 'personal',
} as const;

export type CalendarEntryType = (typeof CALENDAR_ENTRY_TYPES)[keyof typeof CALENDAR_ENTRY_TYPES];

export const CALENDAR_ENTRY_STATUSES = {
  SCHEDULED: 'scheduled',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const;

export type CalendarEntryStatus =
  (typeof CALENDAR_ENTRY_STATUSES)[keyof typeof CALENDAR_ENTRY_STATUSES];

export interface CalendarEntry {
  readonly id: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly type: CalendarEntryType;
  readonly status: CalendarEntryStatus;
  readonly title: string;
}

/** Creates a CalendarEntry after checking its domain invariants. */
export function createCalendarEntry(input: unknown): CalendarEntry {
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('Invalid CalendarEntry');
  }

  const value = input as Record<string, unknown>;
  const start = parseUtcInstant(value.startAt);
  const end = parseUtcInstant(value.endAt);

  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    !isCalendarEntryType(value.type) ||
    !isCalendarEntryStatus(value.status) ||
    start === null ||
    end === null ||
    compareInstants(start, end) >= 0
  ) {
    throw new TypeError('Invalid CalendarEntry');
  }

  return {
    id: value.id,
    startAt: value.startAt as string,
    endAt: value.endAt as string,
    type: value.type,
    status: value.status,
    title: value.title,
  };
}

function isCalendarEntryType(value: unknown): value is CalendarEntryType {
  return Object.values(CALENDAR_ENTRY_TYPES).some(type => type === value);
}

function isCalendarEntryStatus(value: unknown): value is CalendarEntryStatus {
  return Object.values(CALENDAR_ENTRY_STATUSES).some(status => status === value);
}

interface UtcInstant {
  readonly seconds: number;
  readonly fraction: string;
}

const UTC_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/;

function parseUtcInstant(value: unknown): UtcInstant | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = UTC_TIMESTAMP_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = ''] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  if (
    month < 1 || month > 12 ||
    day < 1 || day > daysInMonth(year, month) ||
    hour > 23 || minute > 59 || second > 59
  ) {
    return null;
  }

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);

  return { seconds: date.getTime() / 1000, fraction };
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function compareInstants(left: UtcInstant, right: UtcInstant): number {
  if (left.seconds !== right.seconds) {
    return left.seconds < right.seconds ? -1 : 1;
  }

  const precision = Math.max(left.fraction.length, right.fraction.length);
  for (let index = 0; index < precision; index += 1) {
    const leftDigit = left.fraction.charCodeAt(index) || 48;
    const rightDigit = right.fraction.charCodeAt(index) || 48;
    if (leftDigit !== rightDigit) {
      return leftDigit < rightDigit ? -1 : 1;
    }
  }

  return 0;
}
