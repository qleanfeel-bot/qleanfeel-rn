import type { UnitOfWork } from '../../ports/unit-of-work.js';
import type { AuthenticatedPrincipal } from '../authenticated-principal.js';
import type {
  AuthSessionRepository,
  SessionRefreshTokenRepository,
} from '../ports/authentication-repositories.js';
import type { Clock } from '../ports/credential-services.js';

export class LogoutAuthSession {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly sessions: AuthSessionRepository,
    private readonly refreshTokens: SessionRefreshTokenRepository,
    private readonly clock: Clock,
  ) {}

  async execute(principal: AuthenticatedPrincipal): Promise<void> {
    await this.unitOfWork.execute(async context => {
      const session = await this.sessions.findSessionForUpdate(
        principal.sessionId,
        context,
      );
      if (!session || session.userId !== principal.userId) {
        return;
      }

      if (session.isActive) {
        const revokedAt = this.clock.now();
        await this.sessions.revokeSession(session.id, revokedAt, context);
      }
      await this.refreshTokens.revokeUnconsumedForSession(
        session.id,
        this.clock.now(),
        context,
      );
    });
  }
}
