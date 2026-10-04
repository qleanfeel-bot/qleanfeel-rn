import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Inject, Injectable } from '@nestjs/common';
import type { BackendConfig } from '../../shared/config/backend-config.js';
import { BACKEND_CONFIG } from '../../shared/config/backend-config.js';
import {
  IdentityProofVerifier,
  type VerifiedExternalIdentity,
} from '../../application/identity/ports/identity-proof-verifier.js';
import {
  IdentityProviderUnavailableError,
  InvalidIdentityProofError,
} from '../../application/identity/identity-errors.js';

const firebaseApplicationName = 'qleanfeel-identity-proof';
const invalidProofCodes = new Set([
  'auth/argument-error',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/invalid-id-token',
  'auth/user-disabled',
  'auth/user-not-found',
]);

@Injectable()
export class FirebaseIdentityProofVerifier extends IdentityProofVerifier {
  constructor(@Inject(BACKEND_CONFIG) private readonly config: BackendConfig) {
    super();
  }

  async verify(providerCredential: string): Promise<VerifiedExternalIdentity> {
    if (!providerCredential.trim()) {
      throw new InvalidIdentityProofError();
    }
    if (!this.config.firebaseProjectId) {
      throw new IdentityProviderUnavailableError();
    }

    try {
      const app =
        getApps().find(
          candidate => candidate.name === firebaseApplicationName,
        ) ??
        initializeApp(
          {
            credential: applicationDefault(),
            projectId: this.config.firebaseProjectId,
          },
          firebaseApplicationName,
        );
      const decoded = await getAuth(app).verifyIdToken(
        providerCredential,
        true,
      );
      return { provider: 'firebase', providerSubject: decoded.uid };
    } catch (error) {
      const code = firebaseErrorCode(error);
      if (code && invalidProofCodes.has(code)) {
        throw new InvalidIdentityProofError();
      }
      throw new IdentityProviderUnavailableError();
    }
  }
}

function firebaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  const code = error.code;
  return typeof code === 'string' ? code : undefined;
}
