import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';
import { CleaningNotFoundError } from './cleaning-lifecycle-errors.js';
import {
  CLEANING_READ_OPERATIONS,
  CleaningReadPolicy,
} from './cleaning-read-policy.js';
import { CleaningReadRepository } from './ports/cleaning-read-repository.js';
import type { Cleaning } from '../../domain/cleanings/cleaning.js';

export class GetMyCleaning {
  constructor(
    private readonly cleanings: CleaningReadRepository,
    private readonly policy: CleaningReadPolicy,
  ) {}

  async execute(
    principal: AuthenticatedPrincipal,
    id: string,
  ): Promise<Cleaning> {
    const record = await this.cleanings.findById(id);
    if (!record) throw new CleaningNotFoundError();

    const decision = this.policy.evaluate(
      principal,
      CLEANING_READ_OPERATIONS.READ,
      { orderOwnerUserId: record.orderOwnerUserId },
    );
    if (decision.outcome !== 'permit') {
      // Match missing-resource behavior to conceal another owner's Cleaning.
      throw new CleaningNotFoundError();
    }
    return record.cleaning;
  }
}
