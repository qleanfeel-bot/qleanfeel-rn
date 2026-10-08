import { DENY, PERMIT } from '../authorization/authorization-decision.js';
import type { AuthorizationDecision } from '../authorization/authorization-decision.js';
import type { ResourceAuthorizationPolicy } from '../authorization/resource-authorization-policy.js';
import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';

export const CLEANING_LIFECYCLE_OPERATIONS = {
  START: 'start_cleaning',
  COMPLETE: 'complete_cleaning',
  PARTIALLY_COMPLETE: 'partially_complete_cleaning',
  CANCEL: 'cancel_cleaning',
  MARK_NOT_PERFORMED: 'mark_cleaning_not_performed',
} as const;

export type CleaningLifecycleOperation =
  (typeof CLEANING_LIFECYCLE_OPERATIONS)[keyof typeof CLEANING_LIFECYCLE_OPERATIONS];

export interface CleaningLifecycleFacts {
  readonly orderOwnerUserId: string;
}

/** Resource authorization only; transition validity remains in the Cleaning domain. */
export class CleaningLifecyclePolicy implements ResourceAuthorizationPolicy<
  CleaningLifecycleOperation,
  CleaningLifecycleFacts
> {
  evaluate(
    principal: AuthenticatedPrincipal,
    operation: CleaningLifecycleOperation,
    facts: CleaningLifecycleFacts,
  ): AuthorizationDecision {
    return Object.values(CLEANING_LIFECYCLE_OPERATIONS).includes(operation) &&
      principal.userId.trim().length > 0 &&
      principal.userId === facts.orderOwnerUserId
      ? PERMIT
      : DENY;
  }
}
