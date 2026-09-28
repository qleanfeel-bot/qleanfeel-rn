import type { User } from '../../domain/auth/entities/User';
import type { AuthApi } from '../../application/auth/ports/AuthApi';
import type { AuthProviderAdapter } from '../../application/auth/ports/AuthProviderAdapter';
import type { ProviderCredential } from '../../application/auth/ProviderCredential';
import { AuthStateController } from '../../application/auth/AuthStateController';

const developmentCredential = 'development-preview-credential' as ProviderCredential;

const developmentUser: User = {
  id: 'development-preview-user',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

/**
 * In-memory composition used only to make the authentication UI previewable
 * before provider and backend implementations exist. Use code 000000 to
 * exercise the success path; other values produce a safe invalid-code error.
 */
export function createDevelopmentAuthController(): AuthStateController {
  const provider: AuthProviderAdapter = {
    requestOtp: async () => undefined,
    verifyOtp: async (_phoneNumber, code) => {
      if (code !== '000000') {
        throw { code: 'InvalidCode' };
      }

      return developmentCredential;
    },
    restoreSession: async () => null,
    signOut: async () => undefined,
  };
  const api: AuthApi = {
    bootstrap: async credential => {
      if (credential !== developmentCredential) {
        throw { code: 'AuthenticationRequired' };
      }

      return developmentUser;
    },
    getCurrentUser: async () => developmentUser,
  };

  return new AuthStateController(provider, api);
}
