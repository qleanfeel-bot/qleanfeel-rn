import type { AuthProviderAdapter } from '../../application/auth/ports/AuthProviderAdapter';
import type { ProviderCredential } from '../../application/auth/ProviderCredential';
import type { SessionManager } from '../../application/auth/SessionManager';
import { AuthStateController } from '../../application/auth/AuthStateController';

const developmentCredential =
  'development-preview-credential' as ProviderCredential;

/**
 * In-memory composition used only to make the authentication UI previewable
 * before provider and backend implementations exist. Use code 000000 to
 * exercise the success path; other values produce a safe invalid-code error.
 */
export function createDevelopmentAuthController(
  session: SessionManager,
): AuthStateController {
  const provider: AuthProviderAdapter = {
    requestOtp: async () => undefined,
    verifyOtp: async (_phoneNumber, code) => {
      if (code !== '000000') {
        throw { code: 'InvalidCode' };
      }

      return developmentCredential;
    },
    signOut: async () => undefined,
  };
  return new AuthStateController(provider, session);
}
