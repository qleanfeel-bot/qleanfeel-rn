import type { BackendConfig } from '../../../shared/config/backend-config.js';
import { AuthIdentity } from '../../../domain/identity/auth-identity.js';
import { AuthSession } from '../../../domain/identity/auth-session.js';
import { SessionRefreshToken } from '../../../domain/identity/session-refresh-token.js';
import { User } from '../../../domain/identity/user.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import {
  AccountSuspendedError,
  IdentityProvisioningConflictError,
} from '../identity-errors.js';
import type {
  AuthIdentityRepository,
  AuthSessionRepository,
  SessionRefreshTokenRepository,
  UserRepository,
} from '../ports/authentication-repositories.js';
import type {
  AccessCredentialService,
  Clock,
  IdentifierGenerator,
  RefreshCredentialService,
} from '../ports/credential-services.js';
import type { IdentityProofVerifier } from '../ports/identity-proof-verifier.js';

export interface BootstrapAuthSessionResult {
  readonly user: User;
  readonly session: AuthSession;
  readonly accessToken: string;
  readonly refreshToken: string;
}

export class BootstrapAuthSession {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly proofVerifier: IdentityProofVerifier,
    private readonly users: UserRepository,
    private readonly identities: AuthIdentityRepository,
    private readonly sessions: AuthSessionRepository,
    private readonly refreshTokens: SessionRefreshTokenRepository,
    private readonly refreshCredentialService: RefreshCredentialService,
    private readonly accessCredentialService: AccessCredentialService,
    private readonly identifiers: IdentifierGenerator,
    private readonly clock: Clock,
    private readonly config: Pick<BackendConfig, 'authRefreshTokenTtlSeconds'>,
  ) {}

  async execute(
    providerCredential: string,
  ): Promise<BootstrapAuthSessionResult> {
    const verified = await this.proofVerifier.verify(providerCredential);
    this.accessCredentialService.assertReady();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const provisioned = await this.unitOfWork.execute(async context => {
          let identity: AuthIdentity | undefined =
            await this.identities.findByProviderSubject(
              verified.provider,
              verified.providerSubject,
              context,
            );
          let user: User;
          const authenticatedAt = this.clock.now();

          if (identity) {
            const existingUser = await this.users.findUserById(
              identity.userId,
              context,
            );
            if (!existingUser) {
              throw new IdentityProvisioningConflictError();
            }
            user = existingUser;
            await this.identities.recordAuthentication(
              identity.id,
              authenticatedAt,
              context,
            );
          } else {
            user = User.create(this.identifiers.next(), authenticatedAt);
            identity = new AuthIdentity(
              this.identifiers.next(),
              user.id,
              verified.provider,
              verified.providerSubject,
              authenticatedAt,
              authenticatedAt,
            );
            await this.users.createUser(user, context);
            await this.identities.createIdentity(identity, context);
          }

          if (!user.isActive) {
            throw new AccountSuspendedError();
          }

          const sessionCreatedAt = this.clock.now();
          const session = AuthSession.create(
            this.identifiers.next(),
            user.id,
            sessionCreatedAt,
            new Date(
              sessionCreatedAt.getTime() +
                this.config.authRefreshTokenTtlSeconds * 1000,
            ),
          );
          const credential = this.refreshCredentialService.create(session.id);
          const refreshRecord = new SessionRefreshToken(
            this.identifiers.next(),
            session.id,
            credential.hash,
            sessionCreatedAt,
            session.expiresAt,
            null,
            null,
            null,
          );

          await this.sessions.createSession(session, context);
          await this.refreshTokens.createRefreshToken(refreshRecord, context);

          return { user, session, refreshCredential: credential.value };
        });

        const accessToken = await this.accessCredentialService.issue(
          { userId: provisioned.user.id, sessionId: provisioned.session.id },
          provisioned.session.expiresAt,
        );
        return {
          user: provisioned.user,
          session: provisioned.session,
          accessToken,
          refreshToken: provisioned.refreshCredential,
        };
      } catch (error) {
        if (
          error instanceof IdentityProvisioningConflictError &&
          attempt === 0
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new IdentityProvisioningConflictError();
  }
}
