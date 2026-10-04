import type { UnitOfWorkContext } from '../../ports/unit-of-work.js';
import type { AuthIdentity } from '../../../domain/identity/auth-identity.js';
import type { AuthSession } from '../../../domain/identity/auth-session.js';
import type { SessionRefreshToken } from '../../../domain/identity/session-refresh-token.js';
import type { User } from '../../../domain/identity/user.js';

export abstract class UserRepository {
  abstract findUserById(
    id: string,
    context: UnitOfWorkContext,
  ): Promise<User | undefined>;

  abstract createUser(user: User, context: UnitOfWorkContext): Promise<void>;
}

export abstract class AuthIdentityRepository {
  abstract findByProviderSubject(
    provider: string,
    providerSubject: string,
    context: UnitOfWorkContext,
  ): Promise<AuthIdentity | undefined>;

  abstract createIdentity(
    identity: AuthIdentity,
    context: UnitOfWorkContext,
  ): Promise<void>;

  abstract recordAuthentication(
    identityId: string,
    authenticatedAt: Date,
    context: UnitOfWorkContext,
  ): Promise<void>;
}

export abstract class AuthSessionRepository {
  abstract createSession(
    session: AuthSession,
    context: UnitOfWorkContext,
  ): Promise<void>;

  abstract findSessionById(
    sessionId: string,
    context: UnitOfWorkContext,
  ): Promise<AuthSession | undefined>;

  abstract findSessionForUpdate(
    sessionId: string,
    context: UnitOfWorkContext,
  ): Promise<AuthSession | undefined>;

  abstract revokeSession(
    sessionId: string,
    revokedAt: Date,
    context: UnitOfWorkContext,
  ): Promise<void>;
}

export abstract class SessionRefreshTokenRepository {
  abstract createRefreshToken(
    token: SessionRefreshToken,
    context: UnitOfWorkContext,
  ): Promise<void>;

  abstract findByHash(
    tokenHash: string,
    context: UnitOfWorkContext,
  ): Promise<SessionRefreshToken | undefined>;

  abstract findByHashForUpdate(
    tokenHash: string,
    context: UnitOfWorkContext,
  ): Promise<SessionRefreshToken | undefined>;

  abstract consumeAndReplace(
    tokenId: string,
    consumedAt: Date,
    replacement: SessionRefreshToken,
    context: UnitOfWorkContext,
  ): Promise<boolean>;

  abstract revokeUnconsumedForSession(
    sessionId: string,
    revokedAt: Date,
    context: UnitOfWorkContext,
  ): Promise<void>;
}
