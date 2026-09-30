import type { AccessTokenProvider } from '../../application/auth/ports/AccessTokenProvider';

/** Development-only opaque credential for exercising authenticated transport. */
export class DevelopmentAccessTokenProvider implements AccessTokenProvider {
  public async getAccessToken(): Promise<string> {
    return 'development-api-access-token';
  }
}
