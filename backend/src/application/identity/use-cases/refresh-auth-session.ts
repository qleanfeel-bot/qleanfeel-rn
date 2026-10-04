import type { AuthSession } from '../../../domain/identity/auth-session.js';
import { SessionRefreshToken } from '../../../domain/identity/session-refresh-token.js';
import type { User } from '../../../domain/identity/user.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import {
  AccountSuspendedError,
  InvalidRefreshCredentialError,
} from '../identity-errors.js';
import type {
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

export interface RefreshAuthSessionResult {
  readonly user: User;
  readonly session: AuthSession;
  readonly accessToken: string;
  readonly refreshToken: string;
}

export class RefreshAuthSession {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly users: UserRepository,
    private readonly sessions: AuthSessionRepository,
    private readonly refreshTokens: SessionRefreshTokenRepository,
    private readonly refreshCredentialService: RefreshCredentialService,
    private readonly accessCredentialService: AccessCredentialService,
    private readonly identifiers: IdentifierGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(value: string): Promise<RefreshAuthSessionResult> {
    this.accessCredentialService.assertReady();
    const hash = this.refreshCredentialService.hash(value);
    const rotated = await this.unitOfWork.execute(async context => {
      const tokenHint = await this.refreshTokens.findByHash(hash, context);
      if (
        !tokenHint ||
        !this.refreshCredentialService.hasSessionId(value, tokenHint.sessionId)
      ) {
        throw new InvalidRefreshCredentialError();
      }

      const session = await this.sessions.findSessionForUpdate(
        tokenHint.sessionId,
        context,
      );
      const now = this.clock.now();
      if (
        !session ||
        !session.isActive ||
        session.expiresAt.getTime() <= now.getTime()
      ) {
        throw new InvalidRefreshCredentialError();
      }

      const current = await this.refreshTokens.findByHashForUpdate(
        hash,
        context,
      );
      if (
        !current ||
        current.id !== tokenHint.id ||
        current.sessionId !== session.id ||
        !current.isUsable
      ) {
        throw new InvalidRefreshCredentialError();
      }

      if (
        current.expiresAt.getTime() <= now.getTime() ||
        session.expiresAt.getTime() <= now.getTime()
      ) {
        throw new InvalidRefreshCredentialError();
      }

      const user = await this.users.findUserById(session.userId, context);
      if (!user) {
        throw new InvalidRefreshCredentialError();
      }
      if (!user.isActive) {
        throw new AccountSuspendedError();
      }

      const replacementCredential = this.refreshCredentialService.create(
        session.id,
      );
      const replacement = new SessionRefreshToken(
        this.identifiers.next(),
        session.id,
        replacementCredential.hash,
        now,
        session.expiresAt,
        null,
        null,
        null,
      );
      const consumed = await this.refreshTokens.consumeAndReplace(
        current.id,
        now,
        replacement,
        context,
      );
      if (!consumed) {
        throw new InvalidRefreshCredentialError();
      }

      return { user, session, refreshCredential: replacementCredential.value };
    });

    const accessToken = await this.accessCredentialService.issue(
      { userId: rotated.user.id, sessionId: rotated.session.id },
      rotated.session.expiresAt,
    );
    return {
      user: rotated.user,
      session: rotated.session,
      accessToken,
      refreshToken: rotated.refreshCredential,
    };
  }
}
