import {
  Controller,
  Get,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../../application/identity/authenticated-principal.js';
import { AuthenticatedAccountUnavailableError } from '../../application/identity/identity-errors.js';
import { GetCurrentUser } from '../../application/identity/use-cases/get-current-user.js';
import { CurrentAuthenticatedPrincipal } from './authenticated-principal.decorator.js';
import { QleanfeelAccessGuard } from './qleanfeel-access.guard.js';

@Controller('me')
@UseGuards(QleanfeelAccessGuard)
export class MeController {
  constructor(private readonly getCurrentUser: GetCurrentUser) {}

  @Get()
  async getMe(
    @CurrentAuthenticatedPrincipal() principal: AuthenticatedPrincipal,
  ) {
    try {
      const user = await this.getCurrentUser.execute(principal);
      return {
        id: user.id,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof AuthenticatedAccountUnavailableError) {
        throw new UnauthorizedException('Authentication is invalid.');
      }
      throw new ServiceUnavailableException(
        'The authenticated account is temporarily unavailable.',
      );
    }
  }
}
