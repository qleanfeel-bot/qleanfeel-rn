declare const providerCredentialBrand: unique symbol;

/**
 * Opaque, short-lived credential supplied by an external auth provider.
 * Keep it in memory only; do not persist, inspect, or log it.
 */
export type ProviderCredential = string & {
  readonly [providerCredentialBrand]: true;
};
