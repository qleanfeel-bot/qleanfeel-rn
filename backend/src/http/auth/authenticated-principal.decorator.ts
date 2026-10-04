import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../../application/identity/authenticated-principal.js';

interface AuthenticatedRequest {
  authenticatedPrincipal?: AuthenticatedPrincipal;
}

export const CurrentAuthenticatedPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authenticatedPrincipal) {
      throw new Error('Authenticated principal is missing.');
    }
    return request.authenticatedPrincipal;
  },
);
