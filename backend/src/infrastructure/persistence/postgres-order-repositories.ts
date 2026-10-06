import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UnitOfWorkContext } from '../../application/ports/unit-of-work.js';
import { CalendarEntryRepository } from '../../application/calendar/ports/calendar-entry-repository.js';
import {
  CleaningRepository,
  OrderRepository,
  OrderTermsRepository,
} from '../../application/orders/ports/order-repositories.js';
import type { CalendarEntry } from '../../domain/calendar/calendar-entry.js';
import type { Cleaning } from '../../domain/cleanings/cleaning.js';
import type { OrderTerms } from '../../domain/orders/order-terms.js';
import type { Order } from '../../domain/orders/order.js';
import { TransactionContextRegistry } from './transaction-context.registry.js';
import {
  calendarEntries,
  cleanings,
  orderTerms,
  orders,
} from './schema/index.js';

type DrizzleTransaction = Parameters<
  Parameters<NodePgDatabase['transaction']>[0]
>[0];

@Injectable()
export class PostgresOrderRepositories
  implements
    OrderRepository,
    OrderTermsRepository,
    CleaningRepository,
    CalendarEntryRepository
{
  constructor(
    @Inject(TransactionContextRegistry)
    private readonly contextRegistry: TransactionContextRegistry,
  ) {}

  async create(order: Order, context: UnitOfWorkContext): Promise<void>;
  async create(terms: OrderTerms, context: UnitOfWorkContext): Promise<void>;
  async create(cleaning: Cleaning, context: UnitOfWorkContext): Promise<void>;
  async create(entry: CalendarEntry, context: UnitOfWorkContext): Promise<void>;
  async create(
    record: Order | OrderTerms | Cleaning | CalendarEntry,
    context: UnitOfWorkContext,
  ): Promise<void> {
    const transaction = this.transaction(context);
    if ('origin' in record) {
      await transaction.insert(orders).values({
        id: record.id,
        origin: record.origin,
        createdByUserId: record.createdByUserId,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        version: record.version,
      });
      return;
    }
    if ('revision' in record) {
      await transaction.insert(orderTerms).values({
        id: record.id,
        orderId: record.orderId,
        revision: record.revision,
        customerName: record.customerName,
        customerPhone: record.customerPhone,
        serviceDescription: record.serviceDescription,
        serviceAddress: record.serviceAddress,
        quotedPriceAmountMinor: record.quotedPrice?.amountMinor ?? null,
        quotedPriceCurrencyCode: record.quotedPrice?.currencyCode ?? null,
        notes: record.notes,
        createdAt: record.createdAt,
      });
      return;
    }
    if ('ownerUserId' in record) {
      await transaction.insert(calendarEntries).values({
        id: record.id,
        ownerUserId: record.ownerUserId,
        type: record.type,
        status: record.status,
        title: record.title,
        startAt: new Date(record.startAt),
        endAt: new Date(record.endAt),
        timeZoneId: null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        version: record.version,
      });
      return;
    }
    await transaction.insert(cleanings).values({
      id: record.id,
      orderId: record.orderId,
      calendarEntryId: record.calendarEntryId,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }

  async associateCalendarEntry(
    cleaning: Cleaning,
    context: UnitOfWorkContext,
  ): Promise<void> {
    const updated = await this.transaction(context)
      .update(cleanings)
      .set({ calendarEntryId: cleaning.calendarEntryId })
      .where(eq(cleanings.id, cleaning.id))
      .returning({ id: cleanings.id });
    if (updated.length !== 1) {
      throw new Error(
        'The initial Cleaning could not be associated with its CalendarEntry.',
      );
    }
  }

  private transaction(context: UnitOfWorkContext): DrizzleTransaction {
    return this.contextRegistry.get<DrizzleTransaction>(context);
  }
}
