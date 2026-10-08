import type { UnitOfWorkContext } from '../../ports/unit-of-work.js';
import type { CleaningLifecycleEvent } from '../../../domain/cleanings/cleaning-lifecycle-event.js';
import type { Cleaning } from '../../../domain/cleanings/cleaning.js';

export interface CleaningLifecycleRecord {
  readonly cleaning: Cleaning;
  readonly orderOwnerUserId: string;
}

export abstract class CleaningLifecycleRepository {
  /** Loads Cleaning state and its Order ownership facts using the active transaction. */
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

  abstract appendLifecycleEvent(
    event: CleaningLifecycleEvent,
    context: UnitOfWorkContext,
  ): Promise<void>;
}
