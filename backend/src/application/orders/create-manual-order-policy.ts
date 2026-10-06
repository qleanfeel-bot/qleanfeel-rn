import { DENY, PERMIT } from '../authorization/authorization-decision.js';
import type { AuthorizationDecision } from '../authorization/authorization-decision.js';
import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';

export type CreateManualOrderOperation = 'create_manual_order';

/** Active-account validation is performed by the authenticated request boundary. */
export class CreateManualOrderPolicy {
  evaluate(
    principal: AuthenticatedPrincipal,
    operation: CreateManualOrderOperation,
  ): AuthorizationDecision {
    return principal.userId.trim() && operation === 'create_manual_order'
      ? PERMIT
      : DENY;
  }
}
