import type { AuthenticatedPrincipal } from '../authenticated-principal.js';

export interface VerifiedAccessCredential {
  readonly principal: AuthenticatedPrincipal;
}

export abstract class AccessCredentialService {
  abstract assertReady(): void;
  abstract issue(
    principal: AuthenticatedPrincipal,
    sessionExpiresAt: Date,
  ): Promise<string>;
  abstract verify(credential: string): Promise<VerifiedAccessCredential>;
}

export interface GeneratedRefreshCredential {
  readonly value: string;
  readonly hash: string;
}

export abstract class RefreshCredentialService {
  abstract create(sessionId: string): GeneratedRefreshCredential;
  abstract hash(value: string): string;
  abstract hasSessionId(value: string, sessionId: string): boolean;
}

export abstract class IdentifierGenerator {
  abstract next(): string;
}

export abstract class Clock {
  abstract now(): Date;
}
