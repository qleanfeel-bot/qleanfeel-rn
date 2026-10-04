import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../../application/identity/authenticated-principal.js';
import {
  AccountSuspendedError,
  AuthenticationConfigurationError,
  AuthenticatedAccountUnavailableError,
  InvalidAccessCredentialError,
} from '../../application/identity/identity-errors.js';
import { AuthenticateAccessCredential } from '../../application/identity/use-cases/authenticate-access-credential.js';

interface AuthenticatedRequest {
  headers: { authorization?: string | string[] };
  authenticatedPrincipal?: AuthenticatedPrincipal;
}

@Injectable()
export class QleanfeelAccessGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateAccessCredential) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication is required.');
    }

    const credential = header.slice('Bearer '.length).trim();
    if (!credential) {
      throw new UnauthorizedException('Authentication is required.');
    }

    try {
      request.authenticatedPrincipal =
        await this.authenticate.execute(credential);
      return true;
    } catch (error) {
      if (error instanceof AccountSuspendedError) {
        throw new ForbiddenException('This account is not available.');
      }
      if (error instanceof AuthenticationConfigurationError) {
        throw new ServiceUnavailableException(
          'Authentication is temporarily unavailable.',
        );
      }
      if (
        error instanceof InvalidAccessCredentialError ||
        error instanceof AuthenticatedAccountUnavailableError
      ) {
        throw new UnauthorizedException('Authentication is invalid.');
      }
      throw new ServiceUnavailableException(
        'Authentication is temporarily unavailable.',
      );
    }
  }
}
