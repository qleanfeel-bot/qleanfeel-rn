import type { SecureTokenStore } from '../../application/auth/ports/SecureTokenStore';

/** Non-persistent store for the development-only fake composition and tests. */
export class InMemorySecureTokenStore implements SecureTokenStore {
  private refreshToken: string | null = null;

  public async getRefreshToken(): Promise<string | null> {
    return this.refreshToken;
  }

  public async setRefreshToken(refreshToken: string): Promise<void> {
    this.refreshToken = refreshToken;
  }

  public async deleteRefreshToken(): Promise<void> {
    this.refreshToken = null;
  }
}
