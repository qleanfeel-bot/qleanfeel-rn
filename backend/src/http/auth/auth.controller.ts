import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  Body,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../../application/identity/authenticated-principal.js';
import {
  AccountSuspendedError,
  AuthenticationConfigurationError,
  IdentityProviderUnavailableError,
  IdentityProvisioningConflictError,
  InvalidIdentityProofError,
  InvalidRefreshCredentialError,
} from '../../application/identity/identity-errors.js';
import { BootstrapAuthSession } from '../../application/identity/use-cases/bootstrap-auth-session.js';
import { LogoutAuthSession } from '../../application/identity/use-cases/logout-auth-session.js';
import { RefreshAuthSession } from '../../application/identity/use-cases/refresh-auth-session.js';
import { CurrentAuthenticatedPrincipal } from './authenticated-principal.decorator.js';
import { QleanfeelAccessGuard } from './qleanfeel-access.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly bootstrap: BootstrapAuthSession,
    private readonly refresh: RefreshAuthSession,
    private readonly logout: LogoutAuthSession,
  ) {}

  @Post('bootstrap')
  @HttpCode(HttpStatus.OK)
  async bootstrapSession(@Body() body: unknown) {
    const firebaseIdToken = readCredential(body, 'firebaseIdToken');
    try {
      const result = await this.bootstrap.execute(firebaseIdToken);
      return {
        user: {
          id: result.user.id,
          status: result.user.status,
          createdAt: result.user.createdAt.toISOString(),
        },
        session: {
          id: result.session.id,
          expiresAt: result.session.expiresAt.toISOString(),
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenType: 'Bearer',
      };
    } catch (error) {
      if (error instanceof InvalidIdentityProofError) {
        throw new UnauthorizedException('Identity proof is invalid.');
      }
      if (error instanceof AccountSuspendedError) {
        throw new ForbiddenException('This account is not available.');
      }
      if (error instanceof IdentityProviderUnavailableError) {
        throw new ServiceUnavailableException(
          'Identity provider is temporarily unavailable.',
        );
      }
      if (error instanceof AuthenticationConfigurationError) {
        throw new ServiceUnavailableException(
          'Authentication is temporarily unavailable.',
        );
      }
      if (error instanceof IdentityProvisioningConflictError) {
        throw new ConflictException('Authentication could not be completed.');
      }
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshSession(@Body() body: unknown) {
    const refreshToken = readCredential(body, 'refreshToken');
    try {
      const result = await this.refresh.execute(refreshToken);
      return {
        user: {
          id: result.user.id,
          status: result.user.status,
          createdAt: result.user.createdAt.toISOString(),
        },
        session: {
          id: result.session.id,
          expiresAt: result.session.expiresAt.toISOString(),
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenType: 'Bearer',
      };
    } catch (error) {
      if (error instanceof InvalidRefreshCredentialError) {
        throw new UnauthorizedException('Refresh credential is invalid.');
      }
      if (error instanceof AccountSuspendedError) {
        throw new ForbiddenException('This account is not available.');
      }
      if (error instanceof AuthenticationConfigurationError) {
        throw new ServiceUnavailableException(
          'Authentication is temporarily unavailable.',
        );
      }
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(QleanfeelAccessGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutSession(
    @CurrentAuthenticatedPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    await this.logout.execute(principal);
  }
}

function readCredential(body: unknown, property: string): string {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException(
      'A valid authentication credential is required.',
    );
  }
  const value = (body as Record<string, unknown>)[property];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(
      'A valid authentication credential is required.',
    );
  }
  return value;
}
