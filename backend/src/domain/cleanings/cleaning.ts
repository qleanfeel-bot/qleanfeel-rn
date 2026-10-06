export const CLEANING_STATUSES = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  PARTIALLY_COMPLETED: 'partially_completed',
  NOT_PERFORMED: 'not_performed',
  CANCELLED: 'cancelled',
} as const;

export type CleaningStatus =
  (typeof CLEANING_STATUSES)[keyof typeof CLEANING_STATUSES];

export class Cleaning {
  private constructor(
    readonly id: string,
    readonly orderId: string,
    readonly calendarEntryId: string | null,
    readonly status: CleaningStatus,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly version: number,
  ) {}

  static createInitial(id: string, orderId: string, createdAt: Date): Cleaning {
    if (!id.trim() || !orderId.trim() || !isValidDate(createdAt)) {
      throw new InvalidCleaningError();
    }

    return new Cleaning(
      id,
      orderId,
      null,
      CLEANING_STATUSES.PLANNED,
      new Date(createdAt),
      new Date(createdAt),
      1,
    );
  }

  withCalendarEntry(calendarEntryId: string): Cleaning {
    if (!calendarEntryId.trim() || this.calendarEntryId !== null) {
      throw new InvalidCleaningError();
    }

    return new Cleaning(
      this.id,
      this.orderId,
      calendarEntryId,
      this.status,
      this.createdAt,
      this.updatedAt,
      this.version,
    );
  }
}

export class InvalidCleaningError extends Error {
  constructor() {
    super('Cleaning is invalid.');
    this.name = 'InvalidCleaningError';
  }
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}
