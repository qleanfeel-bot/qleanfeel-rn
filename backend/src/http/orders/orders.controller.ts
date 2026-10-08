import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthorizationDeniedError } from '../../application/authorization/authorization-errors.js';
import { InvalidCalendarScheduleError } from '../../domain/calendar/calendar-entry.js';
import { InvalidCleaningError } from '../../domain/cleanings/cleaning.js';
import { InvalidOrderTermsError } from '../../domain/orders/order-terms.js';
import { InvalidOrderError } from '../../domain/orders/order.js';
import { type AuthenticatedPrincipal } from '../../application/identity/authenticated-principal.js';
import { CreateManualOrder } from '../../application/orders/create-manual-order.js';
import {
  GetMyOrder,
  MyOrderNotFoundError,
} from '../../application/orders/get-my-order.js';
import {
  InvalidOrderListLimitError,
  ListMyOrders,
} from '../../application/orders/list-my-orders.js';
import type { OrderReadModel } from '../../application/orders/ports/order-read-repository.js';
import { CurrentAuthenticatedPrincipal } from '../auth/authenticated-principal.decorator.js';
import { QleanfeelAccessGuard } from '../auth/qleanfeel-access.guard.js';
import { readCreateManualOrderInput } from './create-manual-order.dto.js';
import {
  encodeOrderCursor,
  readListMyOrdersQuery,
} from './list-my-orders.dto.js';

@Controller('me/orders')
@UseGuards(QleanfeelAccessGuard)
export class OrdersController {
  constructor(
    @Inject(CreateManualOrder)
    private readonly createManualOrder: CreateManualOrder,
    @Inject(ListMyOrders)
    private readonly listMyOrders: ListMyOrders,
    @Inject(GetMyOrder)
    private readonly getMyOrder: GetMyOrder,
  ) {}

  @Get()
  async list(
    @CurrentAuthenticatedPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: Record<string, unknown>,
  ) {
    try {
      const result = await this.listMyOrders.execute(
        principal,
        readListMyOrdersQuery(query),
      );
      return {
        items: result.items.map(mapOrderReadModel),
        nextCursor: result.nextPosition
          ? encodeOrderCursor(result.nextPosition)
          : null,
      };
    } catch (error) {
      if (error instanceof InvalidOrderListLimitError) {
        throw new BadRequestException('The order list limit is invalid.');
      }
      throw error;
    }
  }

  @Get(':id')
  async get(
    @CurrentAuthenticatedPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    if (!UUID_PATTERN.test(id)) {
      throw new BadRequestException('Order id must be a UUID.');
    }
    try {
      return mapOrderReadModel(await this.getMyOrder.execute(principal, id));
    } catch (error) {
      if (error instanceof MyOrderNotFoundError) {
        throw new NotFoundException('Order was not found.');
      }
      throw error;
    }
  }

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapOrderReadModel(order: OrderReadModel) {
  return {
    id: order.id,
    origin: order.origin,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    version: order.version,
    terms: order.terms
      ? {
          id: order.terms.id,
          revision: order.terms.revision,
          customerName: order.terms.customerName,
          customerPhone: order.terms.customerPhone,
          serviceDescription: order.terms.serviceDescription,
          serviceAddress: order.terms.serviceAddress,
          quotedPrice: order.terms.quotedPrice,
          notes: order.terms.notes,
          createdAt: order.terms.createdAt.toISOString(),
        }
      : null,
    cleanings: order.cleanings.map(cleaning => ({
      id: cleaning.id,
      status: cleaning.status,
      calendarEntry: cleaning.calendarEntry
        ? {
            id: cleaning.calendarEntry.id,
            startAt: cleaning.calendarEntry.startAt.toISOString(),
            endAt: cleaning.calendarEntry.endAt.toISOString(),
            type: cleaning.calendarEntry.type,
            status: cleaning.calendarEntry.status,
            title: cleaning.calendarEntry.title,
          }
        : null,
    })),
  };
}
