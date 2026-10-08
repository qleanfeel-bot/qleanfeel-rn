import { DENY, PERMIT } from '../authorization/authorization-decision.js';
import type { AuthorizationDecision } from '../authorization/authorization-decision.js';
import type { ResourceAuthorizationPolicy } from '../authorization/resource-authorization-policy.js';
import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';

export const CLEANING_READ_OPERATIONS = {
  READ: 'read_cleaning',
  READ_LIFECYCLE: 'read_cleaning_lifecycle',
} as const;

export type CleaningReadOperation =
  (typeof CLEANING_READ_OPERATIONS)[keyof typeof CLEANING_READ_OPERATIONS];

export interface CleaningReadFacts {
  readonly orderOwnerUserId: string;
}

/** Evaluates ownership facts resolved by the read use case; it performs no I/O. */
export class CleaningReadPolicy implements ResourceAuthorizationPolicy<
  CleaningReadOperation,
  CleaningReadFacts
> {
  evaluate(
    principal: AuthenticatedPrincipal,
    operation: CleaningReadOperation,
    facts: CleaningReadFacts,
  ): AuthorizationDecision {
    return Object.values(CLEANING_READ_OPERATIONS).includes(operation) &&
      principal.userId.trim().length > 0 &&
      principal.userId === facts.orderOwnerUserId
      ? PERMIT
      : DENY;
  }
}
