import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';
import type { CleaningLifecycleEvent } from '../../domain/cleanings/cleaning-lifecycle-event.js';
import { CleaningNotFoundError } from './cleaning-lifecycle-errors.js';
import {
  CLEANING_READ_OPERATIONS,
  CleaningReadPolicy,
} from './cleaning-read-policy.js';
import { CleaningReadRepository } from './ports/cleaning-read-repository.js';

export class GetMyCleaningLifecycle {
  constructor(
    private readonly cleanings: CleaningReadRepository,
    private readonly policy: CleaningReadPolicy,
  ) {}

  async execute(
    principal: AuthenticatedPrincipal,
    id: string,
  ): Promise<readonly CleaningLifecycleEvent[]> {
    const record = await this.cleanings.findById(id);
    if (!record) throw new CleaningNotFoundError();

    const decision = this.policy.evaluate(
      principal,
      CLEANING_READ_OPERATIONS.READ_LIFECYCLE,
      { orderOwnerUserId: record.orderOwnerUserId },
    );
    if (decision.outcome !== 'permit') {
      throw new CleaningNotFoundError();
    }
    return this.cleanings.findLifecycleEvents(id);
  }
}
