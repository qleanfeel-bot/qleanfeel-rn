/** The result of evaluating one application authorization policy. */
export type AuthorizationDecision =
  { readonly outcome: 'permit' } | { readonly outcome: 'deny' };

export const PERMIT: AuthorizationDecision = { outcome: 'permit' };
export const DENY: AuthorizationDecision = { outcome: 'deny' };
