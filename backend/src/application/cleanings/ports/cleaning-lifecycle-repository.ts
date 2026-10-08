import type { UnitOfWorkContext } from '../../ports/unit-of-work.js';
import type { CleaningLifecycleEvent } from '../../../domain/cleanings/cleaning-lifecycle-event.js';
import type { Cleaning } from '../../../domain/cleanings/cleaning.js';

export interface CleaningLifecycleRecord {
  readonly cleaning: Cleaning;
  readonly orderOwnerUserId: string;
}

export abstract class CleaningLifecycleRepository {
  /**
   * Loads and locks Cleaning state plus its Order owner fact in the active
   * transaction. The row lock protects coordinated schedule/execution checks
   * until the UnitOfWork commits or rolls back.
   */
  abstract findForLifecycle(
    cleaningId: string,
    context: UnitOfWorkContext,
  ): Promise<CleaningLifecycleRecord | undefined>;

  /** Compare-and-set state using the version read with the resource. */
  abstract updateState(
    cleaning: Cleaning,
    expectedVersion: number,
    context: UnitOfWorkContext,
  ): Promise<boolean>;

  abstract associateScheduledCalendarEntry(
    cleaning: Cleaning,
    expectedVersion: number,
    context: UnitOfWorkContext,
  ): Promise<boolean>;

  abstract appendLifecycleEvent(
    event: CleaningLifecycleEvent,
    context: UnitOfWorkContext,
  ): Promise<void>;
}
