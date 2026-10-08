import type { Cleaning } from '../../../domain/cleanings/cleaning.js';
import type { CleaningLifecycleEvent } from '../../../domain/cleanings/cleaning-lifecycle-event.js';

export interface CleaningReadRecord {
  readonly cleaning: Cleaning;
  readonly orderOwnerUserId: string;
}

/** Read-only access to canonical Cleaning state and its immutable history. */
export abstract class CleaningReadRepository {
  abstract findById(
    cleaningId: string,
  ): Promise<CleaningReadRecord | undefined>;

  /** Events are returned oldest first, ordered by occurredAt then version. */
  abstract findLifecycleEvents(
    cleaningId: string,
  ): Promise<readonly CleaningLifecycleEvent[]>;
}
