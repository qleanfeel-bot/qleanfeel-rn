import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthorizationDeniedError } from '../../application/authorization/authorization-errors.js';
import { InvalidCalendarScheduleError } from '../../domain/calendar/calendar-entry.js';
import { InvalidCleaningError } from '../../domain/cleanings/cleaning.js';
import { InvalidOrderTermsError } from '../../domain/orders/order-terms.js';
import { InvalidOrderError } from '../../domain/orders/order.js';
import { type AuthenticatedPrincipal } from '../../application/identity/authenticated-principal.js';
import { CreateManualOrder } from '../../application/orders/create-manual-order.js';
import { CurrentAuthenticatedPrincipal } from '../auth/authenticated-principal.decorator.js';
import { QleanfeelAccessGuard } from '../auth/qleanfeel-access.guard.js';
import { readCreateManualOrderInput } from './create-manual-order.dto.js';

@Controller('me/orders')
@UseGuards(QleanfeelAccessGuard)
export class OrdersController {
  constructor(
    @Inject(CreateManualOrder)
    private readonly createManualOrder: CreateManualOrder,
  ) {}

  @Post()
  async create(
    @CurrentAuthenticatedPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
  ) {
    const input = readCreateManualOrderInput(body);
    try {
      const result = await this.createManualOrder.execute(principal, input);
      return {
        order: {
          id: result.order.id,
          origin: result.order.origin,
          createdByUserId: result.order.createdByUserId,
          status: result.order.status,
          createdAt: result.order.createdAt.toISOString(),
          updatedAt: result.order.updatedAt.toISOString(),
          version: result.order.version,
          terms: {
            id: result.terms.id,
            revision: result.terms.revision,
            customerName: result.terms.customerName,
            customerPhone: result.terms.customerPhone,
            serviceDescription: result.terms.serviceDescription,
            serviceAddress: result.terms.serviceAddress,
            quotedPrice: result.terms.quotedPrice,
            notes: result.terms.notes,
            createdAt: result.terms.createdAt.toISOString(),
          },
        },
        initialCleaning: {
          id: result.cleaning.id,
          status: result.cleaning.status,
          calendarEntryId: result.cleaning.calendarEntryId,
          createdAt: result.cleaning.createdAt.toISOString(),
          updatedAt: result.cleaning.updatedAt.toISOString(),
          version: result.cleaning.version,
        },
        calendarEntry: result.calendarEntry
          ? {
              id: result.calendarEntry.id,
              ownerUserId: result.calendarEntry.ownerUserId,
              startAt: new Date(result.calendarEntry.startAt).toISOString(),
              endAt: new Date(result.calendarEntry.endAt).toISOString(),
              type: result.calendarEntry.type,
              status: result.calendarEntry.status,
              title: result.calendarEntry.title,
              createdAt: result.calendarEntry.createdAt.toISOString(),
              updatedAt: result.calendarEntry.updatedAt.toISOString(),
              version: result.calendarEntry.version,
            }
          : null,
      };
    } catch (error) {
      if (error instanceof AuthorizationDeniedError) {
        throw new ForbiddenException('This operation is not permitted.');
      }
      if (
        error instanceof InvalidCalendarScheduleError ||
        error instanceof InvalidCleaningError ||
        error instanceof InvalidOrderTermsError ||
        error instanceof InvalidOrderError
      ) {
        throw new BadRequestException('The order request is invalid.');
      }
      throw error;
    }
  }
}
