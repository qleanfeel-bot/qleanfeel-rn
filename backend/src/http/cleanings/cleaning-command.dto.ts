import { BadRequestException } from '@nestjs/common';

export function assertEmptyCleaningCommandBody(body: unknown): void {
  if (body === undefined) return;
  if (
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    Object.keys(body).length === 0
  ) {
    return;
  }
  throw new BadRequestException(
    'This Cleaning command does not accept a body.',
  );
}
