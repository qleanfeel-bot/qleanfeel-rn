import type { ProviderCredential } from '../ProviderCredential';

/**
 * Provider boundary used by application auth flows.
 * Implementations normalize provider-specific failures to domain AuthError
 * codes. Provider SDK types and exceptions must not cross this boundary.
 */
export interface AuthProviderAdapter {
  requestOtp(phoneNumber: string): Promise<void>;

  /** Returns an opaque credential for the application to pass to AuthApi. */
  verifyOtp(phoneNumber: string, code: string): Promise<ProviderCredential>;

  /** Restores provider-managed state as a credential, not a Qleanfeel session. */
  restoreSession(): Promise<ProviderCredential | null>;

  signOut(): Promise<void>;
}
