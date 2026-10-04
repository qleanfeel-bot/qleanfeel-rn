import { Inject, Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import type { BackendConfig } from '../../shared/config/backend-config.js';
import { BACKEND_CONFIG } from '../../shared/config/backend-config.js';
import type { AuthenticatedPrincipal } from '../../application/identity/authenticated-principal.js';
import {
  AuthenticationConfigurationError,
  InvalidAccessCredentialError,
} from '../../application/identity/identity-errors.js';
import {
  AccessCredentialService,
  type VerifiedAccessCredential,
} from '../../application/identity/ports/credential-services.js';

const credentialIssuer = 'qleanfeel-api';
const credentialAudience = 'qleanfeel-api';

@Injectable()
export class JwtAccessCredentialService extends AccessCredentialService {
  constructor(@Inject(BACKEND_CONFIG) private readonly config: BackendConfig) {
    super();
  }

  assertReady(): void {
    this.secret();
  }

  async issue(
    principal: AuthenticatedPrincipal,
    sessionExpiresAt: Date,
  ): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = Math.min(
      issuedAt + this.config.authAccessTokenTtlSeconds,
      Math.floor(sessionExpiresAt.getTime() / 1000),
    );
    if (expiresAt <= issuedAt) {
      throw new InvalidAccessCredentialError();
    }

    return new SignJWT({ sid: principal.sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(credentialIssuer)
      .setAudience(credentialAudience)
      .setSubject(principal.userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.secret());
  }

  async verify(credential: string): Promise<VerifiedAccessCredential> {
    const secret = this.secret();
    try {
      const { payload } = await jwtVerify(credential, secret, {
        algorithms: ['HS256'],
        issuer: credentialIssuer,
        audience: credentialAudience,
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new InvalidAccessCredentialError();
      }
      return {
        principal: { userId: payload.sub, sessionId: payload.sid },
      };
    } catch {
      throw new InvalidAccessCredentialError();
    }
  }

  private secret(): Uint8Array {
    const value = this.config.accessTokenSigningSecret;
    if (!value || Buffer.byteLength(value, 'utf8') < 32) {
      throw new AuthenticationConfigurationError();
    }
    return new TextEncoder().encode(value);
  }
}
