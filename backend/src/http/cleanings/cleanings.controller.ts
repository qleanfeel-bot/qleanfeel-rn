import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
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
import { GetMyCleaning } from '../../application/cleanings/get-my-cleaning.js';
import { GetMyCleaningLifecycle } from '../../application/cleanings/get-my-cleaning-lifecycle.js';
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
    @Inject(GetMyCleaning)
    private readonly getMyCleaning: GetMyCleaning,
    @Inject(GetMyCleaningLifecycle)
    private readonly getMyCleaningLifecycle: GetMyCleaningLifecycle,
  ) {}

  @Get(':id')
  async get(
    @CurrentAuthenticatedPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    this.assertCleaningId(id);
    try {
      return mapCleaning(await this.getMyCleaning.execute(principal, id));
    } catch (error) {
      this.mapNotFound(error);
      throw error;
    }
  }

  @Get(':id/lifecycle')
  async lifecycle(
    @CurrentAuthenticatedPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    this.assertCleaningId(id);
    try {
      const events = await this.getMyCleaningLifecycle.execute(principal, id);
      return {
        items: events.map(event => ({
          id: event.id,
          cleaningId: event.cleaningId,
          eventType: event.eventType,
          actorUserId: event.actorUserId,
          occurredAt: event.occurredAt.toISOString(),
          recordedAt: event.recordedAt.toISOString(),
          version: event.version,
        })),
      };
    } catch (error) {
      this.mapNotFound(error);
      throw error;
    }
  }

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
    this.assertCleaningId(id);
    assertEmptyCleaningCommandBody(body);
    try {
      const cleaning = await command.execute(principal, id);
      return mapCleaning(cleaning);
    } catch (error) {
      this.mapNotFound(error);
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

  private assertCleaningId(id: string): void {
    if (!UUID_PATTERN.test(id)) {
      throw new BadRequestException('Cleaning id must be a UUID.');
    }
  }

  private mapNotFound(error: unknown): void {
    if (error instanceof CleaningNotFoundError) {
      throw new NotFoundException('Cleaning was not found.');
    }
  }
}

function mapCleaning(cleaning: {
  readonly id: string;
  readonly orderId: string;
  readonly calendarEntryId: string | null;
  readonly status: string;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}) {
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
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
