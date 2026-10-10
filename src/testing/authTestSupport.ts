import type { User } from '../domain/auth/entities/User';
import type { ProviderCredential } from '../application/auth/ProviderCredential';
import type { SecureTokenStore } from '../application/auth/ports/SecureTokenStore';
import type {
  SessionApi,
  QleanfeelSessionCredentials,
} from '../application/auth/ports/SessionApi';
import type { AuthProviderAdapter } from '../application/auth/ports/AuthProviderAdapter';
import { SessionManager } from '../application/auth/SessionManager';
import { AuthStateController } from '../application/auth/AuthStateController';

export const testUser: User = {
  id: 'qleanfeel-user-1',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

export const testProviderCredential =
  'opaque-provider-credential' as ProviderCredential;

export function sessionCredentials(
  user: User = testUser,
  suffix = '1',
): QleanfeelSessionCredentials {
  return {
    user,
    accessToken: `test-access-${suffix}`,
    refreshToken: `test-refresh-${suffix}`,
  };
}

export function createAuthHarness(user: User = testUser) {
  let storedRefreshToken: string | null = null;
  const provider: jest.Mocked<AuthProviderAdapter> = {
    requestOtp: jest.fn().mockResolvedValue(undefined),
    verifyOtp: jest.fn().mockResolvedValue(testProviderCredential),
    signOut: jest.fn().mockResolvedValue(undefined),
  };
  const api: jest.Mocked<SessionApi> = {
    bootstrap: jest.fn().mockResolvedValue(sessionCredentials(user)),
    refresh: jest.fn().mockResolvedValue(sessionCredentials(user)),
    logout: jest.fn().mockResolvedValue(undefined),
  };
  const tokenStore: jest.Mocked<SecureTokenStore> = {
    getRefreshToken: jest.fn(async () => storedRefreshToken),
    setRefreshToken: jest.fn(async token => {
      storedRefreshToken = token;
    }),
    deleteRefreshToken: jest.fn(async () => {
      storedRefreshToken = null;
    }),
  };
  const session = new SessionManager(api, tokenStore);
  const controller = new AuthStateController(provider, session);
  return { controller, provider, api, tokenStore, session };
}
