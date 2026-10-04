import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';
import type { AuthorizationDecision } from './authorization-decision.js';

/**
 * Evaluates an operation against resource and relationship facts already
 * resolved by the application use case from trusted server state.
 * Implementations are pure policy: they do not load resources or manage
 * transactions.
 */
export interface ResourceAuthorizationPolicy<TOperation, TResourceFacts> {
  evaluate(
    principal: AuthenticatedPrincipal,
    operation: TOperation,
    resourceFacts: TResourceFacts,
  ): AuthorizationDecision;
}
