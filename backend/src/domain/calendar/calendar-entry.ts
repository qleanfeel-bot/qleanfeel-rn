export const CALENDAR_ENTRY_TYPES = {
  EXTERNAL_ORDER: 'external_order',
  BLOCKED: 'blocked',
  PERSONAL: 'personal',
} as const;

export type CalendarEntryType =
  (typeof CALENDAR_ENTRY_TYPES)[keyof typeof CALENDAR_ENTRY_TYPES];

export const CALENDAR_ENTRY_STATUSES = {
  SCHEDULED: 'scheduled',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const;

export type CalendarEntryStatus =
  (typeof CALENDAR_ENTRY_STATUSES)[keyof typeof CALENDAR_ENTRY_STATUSES];

export interface CalendarSchedule {
  readonly startAt: string;
  readonly endAt: string;
}

export class CalendarEntry {
  private constructor(
    readonly id: string,
    readonly ownerUserId: string,
    readonly startAt: string,
    readonly endAt: string,
    readonly type: CalendarEntryType,
    readonly status: CalendarEntryStatus,
    readonly title: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly version: number,
  ) {}

  static createScheduled(
    id: string,
    ownerUserId: string,
    schedule: CalendarSchedule,
    title: string,
    createdAt: Date,
  ): CalendarEntry {
    assertValidSchedule(schedule);
    if (
      !id.trim() ||
      !ownerUserId.trim() ||
      !title.trim() ||
      !(createdAt instanceof Date) ||
      !Number.isFinite(createdAt.getTime())
    ) {
      throw new InvalidCalendarScheduleError();
    }

    return new CalendarEntry(
      id,
      ownerUserId,
      schedule.startAt,
      schedule.endAt,
      CALENDAR_ENTRY_TYPES.EXTERNAL_ORDER,
      CALENDAR_ENTRY_STATUSES.SCHEDULED,
      title.trim(),
      new Date(createdAt),
      new Date(createdAt),
      1,
    );
  }

  static reconstitute(input: {
    readonly id: string;
    readonly ownerUserId: string;
    readonly startAt: string;
    readonly endAt: string;
    readonly type: CalendarEntryType;
    readonly status: CalendarEntryStatus;
    readonly title: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly version: number;
  }): CalendarEntry {
    assertValidSchedule({ startAt: input.startAt, endAt: input.endAt });
    if (
      !input.id.trim() ||
      !input.ownerUserId.trim() ||
      !Object.values(CALENDAR_ENTRY_TYPES).includes(input.type) ||
      !Object.values(CALENDAR_ENTRY_STATUSES).includes(input.status) ||
      !input.title.trim() ||
      !isValidDate(input.createdAt) ||
      !isValidDate(input.updatedAt) ||
      input.updatedAt < input.createdAt ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1
    ) {
      throw new InvalidCalendarScheduleError();
    }
    return new CalendarEntry(
      input.id,
      input.ownerUserId,
      input.startAt,
      input.endAt,
      input.type,
      input.status,
      input.title,
      new Date(input.createdAt),
      new Date(input.updatedAt),
      input.version,
    );
  }

  reschedule(schedule: CalendarSchedule, at: Date): CalendarEntry {
    assertValidSchedule(schedule);
    if (
      this.status !== CALENDAR_ENTRY_STATUSES.SCHEDULED ||
      !isValidDate(at) ||
      at < this.updatedAt ||
      this.version >= 2_147_483_647
    ) {
      throw new InvalidCalendarEntryTransitionError();
    }
    return new CalendarEntry(
      this.id,
      this.ownerUserId,
      schedule.startAt,
      schedule.endAt,
      this.type,
      this.status,
      this.title,
      this.createdAt,
      new Date(at),
      this.version + 1,
    );
  }
}

export function assertValidSchedule(schedule: CalendarSchedule): void {
  if (
    !schedule ||
    typeof schedule.startAt !== 'string' ||
    typeof schedule.endAt !== 'string' ||
    compareUtcInstants(schedule.startAt, schedule.endAt) >= 0
  ) {
    throw new InvalidCalendarScheduleError();
  }
}

export class InvalidCalendarScheduleError extends Error {
  constructor() {
    super('Calendar schedule is invalid.');
    this.name = 'InvalidCalendarScheduleError';
  }
}

export class InvalidCalendarEntryTransitionError extends Error {
  constructor() {
    super('Calendar entry cannot be rescheduled in its current state.');
    this.name = 'InvalidCalendarEntryTransitionError';
  }
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function compareUtcInstants(left: string, right: string): number {
  const leftParts = parseUtcInstant(left);
  const rightParts = parseUtcInstant(right);
  if (!leftParts || !rightParts) {
    throw new InvalidCalendarScheduleError();
  }

  if (leftParts.epochSecond !== rightParts.epochSecond) {
    return leftParts.epochSecond < rightParts.epochSecond ? -1 : 1;
  }

  const precision = Math.max(
    leftParts.fraction.length,
    rightParts.fraction.length,
  );
  const leftFraction = leftParts.fraction.padEnd(precision, '0');
  const rightFraction = rightParts.fraction.padEnd(precision, '0');
  return leftFraction === rightFraction
    ? 0
    : leftFraction < rightFraction
      ? -1
      : 1;
}

function parseUtcInstant(
  value: string,
): { readonly epochSecond: number; readonly fraction: string } | undefined {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/.exec(value);
  if (!match) return undefined;

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    fraction = '',
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return undefined;
  }

  return { epochSecond: date.getTime() / 1000, fraction };
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
