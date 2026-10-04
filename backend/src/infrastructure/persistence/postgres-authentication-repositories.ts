import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UnitOfWorkContext } from '../../application/ports/unit-of-work.js';
import {
  AuthIdentityRepository,
  AuthSessionRepository,
  SessionRefreshTokenRepository,
  UserRepository,
} from '../../application/identity/ports/authentication-repositories.js';
import { IdentityProvisioningConflictError } from '../../application/identity/identity-errors.js';
import { AuthIdentity } from '../../domain/identity/auth-identity.js';
import {
  AuthSession,
  type AuthSessionStatus,
} from '../../domain/identity/auth-session.js';
import { SessionRefreshToken } from '../../domain/identity/session-refresh-token.js';
import { User, type UserStatus } from '../../domain/identity/user.js';
import { TransactionContextRegistry } from './transaction-context.registry.js';
import {
  authIdentities,
  authSessions,
  sessionRefreshTokens,
  users,
} from './schema/index.js';

type DrizzleTransaction = Parameters<
  Parameters<NodePgDatabase['transaction']>[0]
>[0];

@Injectable()
export class PostgresAuthenticationRepositories
  implements
    UserRepository,
    AuthIdentityRepository,
    AuthSessionRepository,
    SessionRefreshTokenRepository
{
  constructor(
    @Inject(TransactionContextRegistry)
    private readonly contextRegistry: TransactionContextRegistry,
  ) {}

  async findUserById(
    id: string,
    context: UnitOfWorkContext,
  ): Promise<User | undefined> {
    const [row] = await this.transaction(context)
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ? mapUser(row) : undefined;
  }

  async createUser(user: User, context: UnitOfWorkContext): Promise<void> {
    await this.transaction(context).insert(users).values({
      id: user.id,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  async findByProviderSubject(
    provider: string,
    providerSubject: string,
    context: UnitOfWorkContext,
  ): Promise<AuthIdentity | undefined> {
    const [row] = await this.transaction(context)
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.provider, provider),
          eq(authIdentities.providerSubject, providerSubject),
        ),
      )
      .limit(1);
    return row ? mapIdentity(row) : undefined;
  }

  async createIdentity(
    identity: AuthIdentity,
    context: UnitOfWorkContext,
  ): Promise<void> {
    try {
      await this.transaction(context).insert(authIdentities).values({
        id: identity.id,
        userId: identity.userId,
        provider: identity.provider,
        providerSubject: identity.providerSubject,
        createdAt: identity.createdAt,
        lastAuthenticatedAt: identity.lastAuthenticatedAt,
      });
    } catch (error) {
      if (isProviderSubjectUniqueViolation(error)) {
        throw new IdentityProvisioningConflictError();
      }
      throw error;
    }
  }

  async recordAuthentication(
    identityId: string,
    authenticatedAt: Date,
    context: UnitOfWorkContext,
  ): Promise<void> {
    await this.transaction(context)
      .update(authIdentities)
      .set({ lastAuthenticatedAt: authenticatedAt })
      .where(eq(authIdentities.id, identityId));
  }

  async createSession(
    session: AuthSession,
    context: UnitOfWorkContext,
  ): Promise<void> {
    await this.transaction(context).insert(authSessions).values({
      id: session.id,
      userId: session.userId,
      status: session.status,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    });
  }

  async findSessionById(
    sessionId: string,
    context: UnitOfWorkContext,
  ): Promise<AuthSession | undefined> {
    const [row] = await this.transaction(context)
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, sessionId))
      .limit(1);
    return row ? mapSession(row) : undefined;
  }

  async findSessionForUpdate(
    sessionId: string,
    context: UnitOfWorkContext,
  ): Promise<AuthSession | undefined> {
    const [row] = await this.transaction(context)
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, sessionId))
      .for('update')
      .limit(1);
    return row ? mapSession(row) : undefined;
  }

  async revokeSession(
    sessionId: string,
    revokedAt: Date,
    context: UnitOfWorkContext,
  ): Promise<void> {
    await this.transaction(context)
      .update(authSessions)
      .set({ status: 'revoked', revokedAt })
      .where(eq(authSessions.id, sessionId));
  }

  async createRefreshToken(
    token: SessionRefreshToken,
    context: UnitOfWorkContext,
  ): Promise<void> {
    await this.transaction(context).insert(sessionRefreshTokens).values({
      id: token.id,
      sessionId: token.sessionId,
      tokenHash: token.tokenHash,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      consumedAt: token.consumedAt,
      revokedAt: token.revokedAt,
      replacedById: token.replacedById,
    });
  }

  async findByHashForUpdate(
    tokenHash: string,
    context: UnitOfWorkContext,
  ): Promise<SessionRefreshToken | undefined> {
    const [row] = await this.transaction(context)
      .select()
      .from(sessionRefreshTokens)
      .where(eq(sessionRefreshTokens.tokenHash, tokenHash))
      .for('update')
      .limit(1);
    return row ? mapRefreshToken(row) : undefined;
  }

  async findByHash(
    tokenHash: string,
    context: UnitOfWorkContext,
  ): Promise<SessionRefreshToken | undefined> {
    const [row] = await this.transaction(context)
      .select()
      .from(sessionRefreshTokens)
      .where(eq(sessionRefreshTokens.tokenHash, tokenHash))
      .limit(1);
    return row ? mapRefreshToken(row) : undefined;
  }

  async consumeAndReplace(
    tokenId: string,
    consumedAt: Date,
    replacement: SessionRefreshToken,
    context: UnitOfWorkContext,
  ): Promise<boolean> {
    const transaction = this.transaction(context);
    await transaction.insert(sessionRefreshTokens).values({
      id: replacement.id,
      sessionId: replacement.sessionId,
      tokenHash: replacement.tokenHash,
      createdAt: replacement.createdAt,
      expiresAt: replacement.expiresAt,
      consumedAt: replacement.consumedAt,
      revokedAt: replacement.revokedAt,
      replacedById: replacement.replacedById,
    });

    const updated = await transaction
      .update(sessionRefreshTokens)
      .set({ consumedAt, replacedById: replacement.id })
      .where(
        and(
          eq(sessionRefreshTokens.id, tokenId),
          isNull(sessionRefreshTokens.consumedAt),
          isNull(sessionRefreshTokens.revokedAt),
        ),
      )
      .returning({ id: sessionRefreshTokens.id });

    return updated.length === 1;
  }

  async revokeUnconsumedForSession(
    sessionId: string,
    revokedAt: Date,
    context: UnitOfWorkContext,
  ): Promise<void> {
    await this.transaction(context)
      .update(sessionRefreshTokens)
      .set({ revokedAt })
      .where(
        and(
          eq(sessionRefreshTokens.sessionId, sessionId),
          isNull(sessionRefreshTokens.consumedAt),
          isNull(sessionRefreshTokens.revokedAt),
        ),
      );
  }

  private transaction(context: UnitOfWorkContext): DrizzleTransaction {
    return this.contextRegistry.get<DrizzleTransaction>(context);
  }
}

function mapUser(row: typeof users.$inferSelect): User {
  return new User(
    row.id,
    row.status as UserStatus,
    row.createdAt,
    row.updatedAt,
  );
}

function mapIdentity(row: typeof authIdentities.$inferSelect): AuthIdentity {
  return new AuthIdentity(
    row.id,
    row.userId,
    row.provider,
    row.providerSubject,
    row.createdAt,
    row.lastAuthenticatedAt,
  );
}

function mapSession(row: typeof authSessions.$inferSelect): AuthSession {
  return new AuthSession(
    row.id,
    row.userId,
    row.status as AuthSessionStatus,
    row.createdAt,
    row.expiresAt,
    row.revokedAt,
  );
}

function mapRefreshToken(
  row: typeof sessionRefreshTokens.$inferSelect,
): SessionRefreshToken {
  return new SessionRefreshToken(
    row.id,
    row.sessionId,
    row.tokenHash,
    row.createdAt,
    row.expiresAt,
    row.consumedAt,
    row.revokedAt,
    row.replacedById,
  );
}

function isProviderSubjectUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as { code?: unknown; constraint?: unknown };
  return (
    candidate.code === '23505' &&
    candidate.constraint === 'auth_identities_provider_subject_unique'
  );
}
