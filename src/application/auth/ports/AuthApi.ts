import type { User } from '../../../domain/auth/entities/User';
import type { ProviderCredential } from '../ProviderCredential';

/** Planned backend auth contract; this interface performs no HTTP requests. */
export interface AuthApi {
  /** Planned POST /v1/auth/bootstrap; the backend verifies the credential. */
  bootstrap(providerCredential: ProviderCredential): Promise<User>;

  /** Planned GET /v1/me; the backend resolves the caller's current Qleanfeel User. */
  getCurrentUser(providerCredential: ProviderCredential): Promise<User>;
}
