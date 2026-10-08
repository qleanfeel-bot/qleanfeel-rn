export const CLEANING_LIFECYCLE_EVENT_TYPES = {
  STARTED: 'started',
  COMPLETED: 'completed',
  PARTIALLY_COMPLETED: 'partially_completed',
  CANCELLED: 'cancelled',
  NOT_PERFORMED: 'not_performed',
} as const;

export type CleaningLifecycleEventType =
  (typeof CLEANING_LIFECYCLE_EVENT_TYPES)[keyof typeof CLEANING_LIFECYCLE_EVENT_TYPES];

export class CleaningLifecycleEvent {
  private constructor(
    readonly id: string,
    readonly cleaningId: string,
    readonly eventType: CleaningLifecycleEventType,
    readonly actorUserId: string,
    readonly occurredAt: Date,
    readonly recordedAt: Date,
    readonly version: number,
  ) {}

  static record(
    id: string,
    cleaningId: string,
    eventType: CleaningLifecycleEventType,
    actorUserId: string,
    occurredAt: Date,
    recordedAt: Date,
    version: number,
  ): CleaningLifecycleEvent {
    if (
      !id.trim() ||
      !cleaningId.trim() ||
      !actorUserId.trim() ||
      !isLifecycleEventType(eventType) ||
      !isValidDate(occurredAt) ||
      !isValidDate(recordedAt) ||
      recordedAt < occurredAt ||
      version < 2 ||
      !Number.isSafeInteger(version)
    ) {
      throw new InvalidCleaningLifecycleEventError();
    }
    return new CleaningLifecycleEvent(
      id,
      cleaningId,
      eventType,
      actorUserId,
      new Date(occurredAt),
      new Date(recordedAt),
      version,
    );
  }
}

export class InvalidCleaningLifecycleEventError extends Error {
  constructor() {
    super('Cleaning lifecycle event is invalid.');
    this.name = 'InvalidCleaningLifecycleEventError';
  }
}

function isLifecycleEventType(
  value: string,
): value is CleaningLifecycleEventType {
  return Object.values(CLEANING_LIFECYCLE_EVENT_TYPES).includes(
    value as CleaningLifecycleEventType,
  );
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}
