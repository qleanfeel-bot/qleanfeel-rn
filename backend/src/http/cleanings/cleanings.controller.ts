import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../../application/identity/authenticated-principal.js';
import { CancelCleaning } from '../../application/cleanings/cancel-cleaning.js';
import {
  CleaningNotFoundError,
  CleaningVersionConflictError,
} from '../../application/cleanings/cleaning-lifecycle-errors.js';
import { CompleteCleaning } from '../../application/cleanings/complete-cleaning.js';
import { MarkCleaningNotPerformed } from '../../application/cleanings/mark-cleaning-not-performed.js';
import { PartiallyCompleteCleaning } from '../../application/cleanings/partially-complete-cleaning.js';
import { StartCleaning } from '../../application/cleanings/start-cleaning.js';
import {
  InvalidCleaningError,
  InvalidCleaningTransitionError,
} from '../../domain/cleanings/cleaning.js';
import { CurrentAuthenticatedPrincipal } from '../auth/authenticated-principal.decorator.js';
import { QleanfeelAccessGuard } from '../auth/qleanfeel-access.guard.js';
import { assertEmptyCleaningCommandBody } from './cleaning-command.dto.js';

interface CleaningCommand {
  execute(
    principal: AuthenticatedPrincipal,
    cleaningId: string,
  ): Promise<{
    id: string;
    orderId: string;
    calendarEntryId: string | null;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }>;
}

@Controller('me/cleanings')
@UseGuards(QleanfeelAccessGuard)
export class CleaningsController {
  constructor(
    @Inject(StartCleaning) private readonly startCleaning: StartCleaning,
    @Inject(CompleteCleaning)
    private readonly completeCleaning: CompleteCleaning,
    @Inject(PartiallyCompleteCleaning)
    private readonly partiallyCompleteCleaning: PartiallyCompleteCleaning,
    @Inject(CancelCleaning) private readonly cancelCleaning: CancelCleaning,
    @Inject(MarkCleaningNotPerformed)
    private readonly markCleaningNotPerformed: MarkCleaningNotPerformed,
  ) {}

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  start(
    @CurrentAuthenticatedPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.execute(this.startCleaning, principal, id, body);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentAuthenticatedPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.execute(this.completeCleaning, principal, id, body);
  }

  @Post(':id/partially-complete')
  @HttpCode(HttpStatus.OK)
  partiallyComplete(
    @CurrentAuthenticatedPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.execute(this.partiallyCompleteCleaning, principal, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentAuthenticatedPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.execute(this.cancelCleaning, principal, id, body);
  }

  @Post(':id/not-performed')
  @HttpCode(HttpStatus.OK)
  markNotPerformed(
    @CurrentAuthenticatedPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.execute(this.markCleaningNotPerformed, principal, id, body);
  }

  private async execute(
    command: CleaningCommand,
    principal: AuthenticatedPrincipal,
    id: string,
    body: unknown,
  ) {
    if (!UUID_PATTERN.test(id)) {
      throw new BadRequestException('Cleaning id must be a UUID.');
    }
    assertEmptyCleaningCommandBody(body);
    try {
      const cleaning = await command.execute(principal, id);
      return {
        id: cleaning.id,
        orderId: cleaning.orderId,
        calendarEntryId: cleaning.calendarEntryId,
        status: cleaning.status,
        startedAt: cleaning.startedAt?.toISOString() ?? null,
        completedAt: cleaning.completedAt?.toISOString() ?? null,
        createdAt: cleaning.createdAt.toISOString(),
        updatedAt: cleaning.updatedAt.toISOString(),
        version: cleaning.version,
      };
    } catch (error) {
      if (error instanceof CleaningNotFoundError) {
        throw new NotFoundException('Cleaning was not found.');
      }
      if (
        error instanceof InvalidCleaningTransitionError ||
        error instanceof CleaningVersionConflictError
      ) {
        throw new ConflictException(
          'The Cleaning changed or cannot use that transition.',
        );
      }
      if (error instanceof InvalidCleaningError) {
        throw new BadRequestException('The Cleaning command is invalid.');
      }
      throw error;
    }
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
