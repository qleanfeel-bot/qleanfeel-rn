import type { User } from '../../domain/auth/entities/User';
import type { ProviderCredential } from '../../application/auth/ProviderCredential';
import type {
  QleanfeelSessionCredentials,
  SessionApi,
} from '../../application/auth/ports/SessionApi';

const developmentUser: User = {
  id: 'development-preview-user',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

/** Explicit fake session API used only by the in-memory development composition. */
export class DevelopmentSessionApi implements SessionApi {
  private rotation = 0;

  public async bootstrap(
    _providerCredential: ProviderCredential,
  ): Promise<QleanfeelSessionCredentials> {
    this.rotation = 1;
    return this.credentials();
  }

  public async refresh(
    _refreshToken: string,
  ): Promise<QleanfeelSessionCredentials> {
    this.rotation += 1;
    return this.credentials();
  }

  public async logout(_accessToken: string): Promise<void> {}

  private credentials(): QleanfeelSessionCredentials {
    return {
      user: developmentUser,
      accessToken: `development-access-${this.rotation}`,
      refreshToken: `development-refresh-${this.rotation}`,
    };
  }
}
