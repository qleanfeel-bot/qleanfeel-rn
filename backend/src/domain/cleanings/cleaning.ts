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
    readonly startedAt: Date | null,
    readonly completedAt: Date | null,
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
      null,
      null,
      new Date(createdAt),
      new Date(createdAt),
      1,
    );
  }

  static reconstitute(input: {
    readonly id: string;
    readonly orderId: string;
    readonly calendarEntryId: string | null;
    readonly status: CleaningStatus;
    readonly startedAt: Date | null;
    readonly completedAt: Date | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly version: number;
  }): Cleaning {
    const knownStatus = Object.values(CLEANING_STATUSES).includes(input.status);
    const validLifecycleTimestamps =
      (input.status === CLEANING_STATUSES.PLANNED &&
        input.startedAt === null &&
        input.completedAt === null) ||
      (input.status === CLEANING_STATUSES.IN_PROGRESS &&
        isValidDate(input.startedAt) &&
        input.completedAt === null) ||
      ((input.status === CLEANING_STATUSES.COMPLETED ||
        input.status === CLEANING_STATUSES.PARTIALLY_COMPLETED) &&
        isValidDate(input.startedAt) &&
        isValidDate(input.completedAt)) ||
      (input.status === CLEANING_STATUSES.NOT_PERFORMED &&
        (input.startedAt === null || isValidDate(input.startedAt)) &&
        isValidDate(input.completedAt)) ||
      (input.status === CLEANING_STATUSES.CANCELLED &&
        input.startedAt === null &&
        input.completedAt === null);
    if (
      !input.id.trim() ||
      !input.orderId.trim() ||
      (input.calendarEntryId !== null && !input.calendarEntryId.trim()) ||
      !knownStatus ||
      !validLifecycleTimestamps ||
      !isValidDate(input.createdAt) ||
      !isValidDate(input.updatedAt) ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      input.updatedAt < input.createdAt ||
      (input.startedAt !== null && input.startedAt > input.updatedAt) ||
      (input.completedAt !== null && input.completedAt > input.updatedAt) ||
      (input.startedAt !== null &&
        input.completedAt !== null &&
        input.completedAt < input.startedAt)
    ) {
      throw new InvalidCleaningError();
    }
    return new Cleaning(
      input.id,
      input.orderId,
      input.calendarEntryId,
      input.status,
      input.startedAt ? new Date(input.startedAt) : null,
      input.completedAt ? new Date(input.completedAt) : null,
      new Date(input.createdAt),
      new Date(input.updatedAt),
      input.version,
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
      this.startedAt,
      this.completedAt,
      this.createdAt,
      this.updatedAt,
      this.version,
    );
  }

  scheduleWithCalendarEntry(calendarEntryId: string, at: Date): Cleaning {
    if (
      this.status !== CLEANING_STATUSES.PLANNED ||
      this.calendarEntryId !== null ||
      !calendarEntryId.trim() ||
      !isValidDate(at) ||
      at < this.updatedAt ||
      this.version >= 2_147_483_647
    ) {
      throw new InvalidCleaningSchedulingError();
    }
    return new Cleaning(
      this.id,
      this.orderId,
      calendarEntryId,
      this.status,
      this.startedAt,
      this.completedAt,
      this.createdAt,
      new Date(at),
      this.version + 1,
    );
  }

  start(at: Date): Cleaning {
    this.assertTransition(CLEANING_STATUSES.IN_PROGRESS, at);
    if (this.status !== CLEANING_STATUSES.PLANNED) {
      throw new InvalidCleaningTransitionError(
        this.status,
        CLEANING_STATUSES.IN_PROGRESS,
      );
    }
    return this.withState(CLEANING_STATUSES.IN_PROGRESS, at, null, at);
  }

  complete(at: Date): Cleaning {
    this.assertTransition(CLEANING_STATUSES.COMPLETED, at);
    if (this.status !== CLEANING_STATUSES.IN_PROGRESS) {
      throw new InvalidCleaningTransitionError(
        this.status,
        CLEANING_STATUSES.COMPLETED,
      );
    }
    return this.withState(CLEANING_STATUSES.COMPLETED, this.startedAt, at, at);
  }

  partiallyComplete(at: Date): Cleaning {
    this.assertTransition(CLEANING_STATUSES.PARTIALLY_COMPLETED, at);
    if (this.status !== CLEANING_STATUSES.IN_PROGRESS) {
      throw new InvalidCleaningTransitionError(
        this.status,
        CLEANING_STATUSES.PARTIALLY_COMPLETED,
      );
    }
    return this.withState(
      CLEANING_STATUSES.PARTIALLY_COMPLETED,
      this.startedAt,
      at,
      at,
    );
  }

  cancel(at: Date): Cleaning {
    this.assertTransition(CLEANING_STATUSES.CANCELLED, at);
    if (this.status !== CLEANING_STATUSES.PLANNED) {
      throw new InvalidCleaningTransitionError(
        this.status,
        CLEANING_STATUSES.CANCELLED,
      );
    }
    return this.withState(CLEANING_STATUSES.CANCELLED, null, null, at);
  }

  markNotPerformed(at: Date): Cleaning {
    this.assertTransition(CLEANING_STATUSES.NOT_PERFORMED, at);
    if (
      this.status !== CLEANING_STATUSES.PLANNED &&
      this.status !== CLEANING_STATUSES.IN_PROGRESS
    ) {
      throw new InvalidCleaningTransitionError(
        this.status,
        CLEANING_STATUSES.NOT_PERFORMED,
      );
    }
    return this.withState(
      CLEANING_STATUSES.NOT_PERFORMED,
      this.startedAt,
      at,
      at,
    );
  }

  private assertTransition(nextStatus: CleaningStatus, at: Date): void {
    if (
      !isValidDate(at) ||
      at < this.updatedAt ||
      this.version >= 2_147_483_647
    ) {
      throw new InvalidCleaningError();
    }
    if (this.completedAt !== null) {
      throw new InvalidCleaningTransitionError(this.status, nextStatus);
    }
  }

  private withState(
    status: CleaningStatus,
    startedAt: Date | null,
    completedAt: Date | null,
    updatedAt: Date,
  ): Cleaning {
    return new Cleaning(
      this.id,
      this.orderId,
      this.calendarEntryId,
      status,
      startedAt ? new Date(startedAt) : null,
      completedAt ? new Date(completedAt) : null,
      this.createdAt,
      new Date(updatedAt),
      this.version + 1,
    );
  }
}

export class InvalidCleaningError extends Error {
  constructor() {
    super('Cleaning is invalid.');
    this.name = 'InvalidCleaningError';
  }
}

export class InvalidCleaningTransitionError extends Error {
  constructor(
    readonly currentStatus: CleaningStatus,
    readonly requestedStatus: CleaningStatus,
  ) {
    super(
      `Cleaning cannot transition from ${currentStatus} to ${requestedStatus}.`,
    );
    this.name = 'InvalidCleaningTransitionError';
  }
}

export class InvalidCleaningSchedulingError extends Error {
  constructor() {
    super('Cleaning cannot be scheduled in its current state.');
    this.name = 'InvalidCleaningSchedulingError';
  }
}

function isValidDate(value: Date | null): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}
