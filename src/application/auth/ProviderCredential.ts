declare const providerCredentialBrand: unique symbol;

/**
 * Opaque, short-lived credential supplied by an external auth provider.
 * The application may pass it to AuthApi for backend verification. It is not
 * a User, AuthIdentity, or AuthSession. Keep it in memory only; do not persist,
 * inspect, or log it, and release it when no longer needed.
 */
export type ProviderCredential = string & {
  readonly [providerCredentialBrand]: true;
};
