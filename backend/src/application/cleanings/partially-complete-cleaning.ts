import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';
import type {
  Clock,
  IdentifierGenerator,
} from '../identity/ports/credential-services.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import { CLEANING_LIFECYCLE_EVENT_TYPES } from '../../domain/cleanings/cleaning-lifecycle-event.js';
import {
  CLEANING_LIFECYCLE_OPERATIONS,
  CleaningLifecyclePolicy,
} from './cleaning-lifecycle-policy.js';
import {
  loadOwnedCleaning,
  persistCleaningTransition,
} from './cleaning-lifecycle-command-support.js';
import { CleaningLifecycleRepository } from './ports/cleaning-lifecycle-repository.js';

export class PartiallyCompleteCleaning {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly cleanings: CleaningLifecycleRepository,
    private readonly policy: CleaningLifecyclePolicy,
    private readonly identifiers: IdentifierGenerator,
    private readonly clock: Clock,
  ) {}

  execute(principal: AuthenticatedPrincipal, cleaningId: string) {
    return this.unitOfWork.execute(async context => {
      const record = await loadOwnedCleaning(
        this.cleanings,
        this.policy,
        principal,
        cleaningId,
        CLEANING_LIFECYCLE_OPERATIONS.PARTIALLY_COMPLETE,
        context,
      );
      const now = this.clock.now();
      const updated = record.cleaning.partiallyComplete(now);
      return persistCleaningTransition(
        this.cleanings,
        this.identifiers,
        principal,
        record.cleaning,
        updated,
        CLEANING_LIFECYCLE_EVENT_TYPES.PARTIALLY_COMPLETED,
        now,
        context,
      );
    });
  }
}
