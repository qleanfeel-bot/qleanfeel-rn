import type { ProviderCredential } from '../ProviderCredential';

/**
 * Provider boundary used by application auth flows.
 * Implementations normalize provider-specific failures to domain AuthError
 * codes. Provider SDK types and exceptions must not cross this boundary.
 */
export interface AuthProviderAdapter {
  requestOtp(phoneNumber: string): Promise<void>;
  verifyOtp(phoneNumber: string, code: string): Promise<ProviderCredential>;
  restoreSession(): Promise<ProviderCredential | null>;
  signOut(): Promise<void>;
}
