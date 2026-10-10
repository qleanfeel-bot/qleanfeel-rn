import type { User } from '../../../domain/auth/entities/User';
import type { ProviderCredential } from '../ProviderCredential';

export interface QleanfeelSessionCredentials {
  readonly user: User;
  readonly accessToken: string;
  readonly refreshToken: string;
}

/** Backend session operations. Provider proof is used only for bootstrap. */
export interface SessionApi {
  bootstrap(
    providerCredential: ProviderCredential,
  ): Promise<QleanfeelSessionCredentials>;
  refresh(refreshToken: string): Promise<QleanfeelSessionCredentials>;
  logout(accessToken: string): Promise<void>;
}
