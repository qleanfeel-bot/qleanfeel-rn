import type { UnitOfWork } from '../../ports/unit-of-work.js';
import type { AuthenticatedPrincipal } from '../authenticated-principal.js';
import { AuthenticatedAccountUnavailableError } from '../identity-errors.js';
import type { UserRepository } from '../ports/authentication-repositories.js';
import type { User } from '../../../domain/identity/user.js';

export class GetCurrentUser {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly users: UserRepository,
  ) {}

  execute(principal: AuthenticatedPrincipal): Promise<User> {
    return this.unitOfWork.execute(async context => {
      const user = await this.users.findUserById(principal.userId, context);
      if (!user || !user.isActive) {
        throw new AuthenticatedAccountUnavailableError();
      }
      return user;
    });
  }
}
