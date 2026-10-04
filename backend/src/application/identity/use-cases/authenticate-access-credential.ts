import type { UnitOfWork } from '../../ports/unit-of-work.js';
import type { AuthenticatedPrincipal } from '../authenticated-principal.js';
import {
  AccountSuspendedError,
  AuthenticatedAccountUnavailableError,
} from '../identity-errors.js';
import type {
  AuthSessionRepository,
  UserRepository,
} from '../ports/authentication-repositories.js';
import type {
  AccessCredentialService,
  Clock,
} from '../ports/credential-services.js';

export class AuthenticateAccessCredential {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly credentials: AccessCredentialService,
    private readonly sessions: AuthSessionRepository,
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(value: string): Promise<AuthenticatedPrincipal> {
    const verified = await this.credentials.verify(value);
    const now = this.clock.now();

    return this.unitOfWork.execute(async context => {
      const session = await this.sessions.findSessionById(
        verified.principal.sessionId,
        context,
      );
      if (
        !session ||
        session.userId !== verified.principal.userId ||
        !session.isActive ||
        session.expiresAt.getTime() <= now.getTime()
      ) {
        throw new AuthenticatedAccountUnavailableError();
      }

      const user = await this.users.findUserById(session.userId, context);
      if (!user) {
        throw new AuthenticatedAccountUnavailableError();
      }
      if (!user.isActive) {
        throw new AccountSuspendedError();
      }

      return verified.principal;
    });
  }
}
