import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, lt, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { OrderReadRepository } from '../../application/orders/ports/order-read-repository.js';
import type {
  OrderReadCalendarEntry,
  OrderReadCleaning,
  OrderReadModel,
  OrderReadPosition,
  OrderReadTerms,
} from '../../application/orders/ports/order-read-repository.js';
import type {
  CalendarEntryStatus,
  CalendarEntryType,
} from '../../domain/calendar/calendar-entry.js';
import type { CleaningStatus } from '../../domain/cleanings/cleaning.js';
import type { OrderOrigin, OrderStatus } from '../../domain/orders/order.js';
import { DRIZZLE_DATABASE } from './database.tokens.js';
import {
  calendarEntries,
  cleanings,
  orderTerms,
  orders,
} from './schema/index.js';

type OrderRow = typeof orders.$inferSelect;

@Injectable()
export class PostgresOrderReadRepository extends OrderReadRepository {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: NodePgDatabase,
  ) {
    super();
  }

  async listOwned(
    ownerUserId: string,
    before: OrderReadPosition | undefined,
    take: number,
  ): Promise<readonly OrderReadModel[]> {
    const ownerFilter = eq(orders.createdByUserId, ownerUserId);
    const positionFilter = before
      ? or(
          lt(orders.createdAt, before.createdAt),
          and(eq(orders.createdAt, before.createdAt), lt(orders.id, before.id)),
        )
      : undefined;
    const rows = await this.database
      .select()
      .from(orders)
      .where(positionFilter ? and(ownerFilter, positionFilter) : ownerFilter)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(take);

    return this.hydrate(rows);
  }

  async findById(id: string): Promise<OrderReadModel | undefined> {
    const [row] = await this.database
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);
    if (!row) return undefined;
    const [order] = await this.hydrate([row]);
    return order;
  }

  private async hydrate(rows: readonly OrderRow[]): Promise<OrderReadModel[]> {
    if (rows.length === 0) return [];
    const ids = rows.map(row => row.id);
    const [terms, cleaningRows] = await Promise.all([
      this.database
        .selectDistinctOn([orderTerms.orderId])
        .from(orderTerms)
        .where(inArray(orderTerms.orderId, ids))
        .orderBy(orderTerms.orderId, desc(orderTerms.revision)),
      this.database
        .select({
          orderId: cleanings.orderId,
          cleaningId: cleanings.id,
          cleaningStatus: cleanings.status,
          calendarEntryId: calendarEntries.id,
          calendarStartAt: calendarEntries.startAt,
          calendarEndAt: calendarEntries.endAt,
          calendarType: calendarEntries.type,
          calendarStatus: calendarEntries.status,
          calendarTitle: calendarEntries.title,
        })
        .from(cleanings)
        .leftJoin(
          calendarEntries,
          eq(cleanings.calendarEntryId, calendarEntries.id),
        )
        .where(inArray(cleanings.orderId, ids))
        .orderBy(
          asc(cleanings.orderId),
          asc(cleanings.createdAt),
          asc(cleanings.id),
        ),
    ]);

    const termsByOrder = new Map<string, OrderReadTerms>();
    for (const row of terms) {
      termsByOrder.set(row.orderId, {
        id: row.id,
        revision: row.revision,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        serviceDescription: row.serviceDescription,
        serviceAddress: row.serviceAddress,
        quotedPrice:
          row.quotedPriceAmountMinor === null ||
          row.quotedPriceCurrencyCode === null
            ? null
            : {
                amountMinor: row.quotedPriceAmountMinor,
                currencyCode: row.quotedPriceCurrencyCode,
              },
        notes: row.notes,
        createdAt: row.createdAt,
      });
    }

    const cleaningsByOrder = new Map<string, OrderReadCleaning[]>();
    for (const row of cleaningRows) {
      if (!row.cleaningId) continue;
      const calendarEntry: OrderReadCalendarEntry | null =
        row.calendarEntryId &&
        row.calendarStartAt &&
        row.calendarEndAt &&
        row.calendarType &&
        row.calendarStatus &&
        row.calendarTitle !== null
          ? {
              id: row.calendarEntryId,
              startAt: row.calendarStartAt,
              endAt: row.calendarEndAt,
              type: row.calendarType as CalendarEntryType,
              status: row.calendarStatus as CalendarEntryStatus,
              title: row.calendarTitle,
            }
          : null;
      const items = cleaningsByOrder.get(row.orderId) ?? [];
      items.push({
        id: row.cleaningId,
        status: row.cleaningStatus as CleaningStatus,
        calendarEntry,
      });
      cleaningsByOrder.set(row.orderId, items);
    }

    return rows.map(row =>
      mapOrder(
        row,
        termsByOrder.get(row.id) ?? null,
        cleaningsByOrder.get(row.id) ?? [],
      ),
    );
  }
}

function mapOrder(
  row: OrderRow,
  terms: OrderReadTerms | null,
  orderCleanings: readonly OrderReadCleaning[],
): OrderReadModel {
  return {
    id: row.id,
    ownerUserId: row.createdByUserId,
    origin: row.origin as OrderOrigin,
    status: row.status as OrderStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
    terms,
    cleanings: orderCleanings,
  };
}
