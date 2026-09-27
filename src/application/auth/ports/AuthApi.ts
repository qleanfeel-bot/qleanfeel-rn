import type { User } from '../../../domain/auth/entities/User';
import type { ProviderCredential } from '../ProviderCredential';

/**
 * Planned backend auth contract; this interface performs no HTTP requests.
 * Credentials are forwarded for server-side verification and are never stored
 * here. The backend remains authoritative for the caller's identity and access.
 */
export interface AuthApi {
  /** Planned POST /v1/auth/bootstrap; returns the internal Qleanfeel User. */
  bootstrap(providerCredential: ProviderCredential): Promise<User>;

  /** Planned GET /v1/me; the backend resolves the caller's current Qleanfeel User. */
  getCurrentUser(providerCredential: ProviderCredential): Promise<User>;
}
