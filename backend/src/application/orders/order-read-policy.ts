import { DENY, PERMIT } from '../authorization/authorization-decision.js';
import type { AuthorizationDecision } from '../authorization/authorization-decision.js';
import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';
import type { ResourceAuthorizationPolicy } from '../authorization/resource-authorization-policy.js';

export interface OrderReadFacts {
  readonly ownerUserId: string;
}

export type OrderReadOperation = 'read_order';

export class OrderReadPolicy implements ResourceAuthorizationPolicy<
  OrderReadOperation,
  OrderReadFacts
> {
  evaluate(
    principal: AuthenticatedPrincipal,
    operation: OrderReadOperation,
    facts: OrderReadFacts,
  ): AuthorizationDecision {
    return principal.userId.trim() &&
      operation === 'read_order' &&
      principal.userId === facts.ownerUserId
      ? PERMIT
      : DENY;
  }
}
