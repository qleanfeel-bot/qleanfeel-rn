import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { CleaningLifecycleRepository as CleaningLifecyclePort } from '../../application/cleanings/ports/cleaning-lifecycle-repository.js';
import type { UnitOfWorkContext } from '../../application/ports/unit-of-work.js';
import { Cleaning } from '../../domain/cleanings/cleaning.js';
import type { CleaningStatus } from '../../domain/cleanings/cleaning.js';
import type { CleaningLifecycleEvent } from '../../domain/cleanings/cleaning-lifecycle-event.js';
import { TransactionContextRegistry } from './transaction-context.registry.js';
import { cleaningLifecycleEvents, cleanings, orders } from './schema/index.js';

type DrizzleTransaction = Parameters<
  Parameters<NodePgDatabase['transaction']>[0]
>[0];

@Injectable()
export class PostgresCleaningLifecycleRepository implements CleaningLifecyclePort {
  constructor(
    @Inject(TransactionContextRegistry)
    private readonly contextRegistry: TransactionContextRegistry,
  ) {}

  async findForLifecycle(cleaningId: string, context: UnitOfWorkContext) {
    const transaction = this.transaction(context);
    const [row] = await transaction
      .select()
      .from(cleanings)
      .where(eq(cleanings.id, cleaningId))
      .limit(1)
      .for('update');
    if (!row) return undefined;
    const [order] = await transaction
      .select({ ownerUserId: orders.createdByUserId })
      .from(orders)
      .where(eq(orders.id, row.orderId))
      .limit(1);
    if (!order) return undefined;
    return {
      cleaning: Cleaning.reconstitute({
        id: row.id,
        orderId: row.orderId,
        calendarEntryId: row.calendarEntryId,
        status: row.status as CleaningStatus,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        version: row.version,
      }),
      orderOwnerUserId: order.ownerUserId,
    };
  }

  async updateState(
    cleaning: Cleaning,
    expectedVersion: number,
    context: UnitOfWorkContext,
  ): Promise<boolean> {
    const rows = await this.transaction(context)
      .update(cleanings)
      .set({
        status: cleaning.status,
        startedAt: cleaning.startedAt,
        completedAt: cleaning.completedAt,
        updatedAt: cleaning.updatedAt,
        version: cleaning.version,
      })
      .where(
        and(
          eq(cleanings.id, cleaning.id),
          eq(cleanings.version, expectedVersion),
        ),
      )
      .returning({ id: cleanings.id });
    return rows.length === 1;
  }

  async associateScheduledCalendarEntry(
    cleaning: Cleaning,
    expectedVersion: number,
    context: UnitOfWorkContext,
  ): Promise<boolean> {
    const rows = await this.transaction(context)
      .update(cleanings)
      .set({
        calendarEntryId: cleaning.calendarEntryId,
        updatedAt: cleaning.updatedAt,
        version: cleaning.version,
      })
      .where(
        and(
          eq(cleanings.id, cleaning.id),
          eq(cleanings.status, 'planned'),
          isNull(cleanings.calendarEntryId),
          eq(cleanings.version, expectedVersion),
        ),
      )
      .returning({ id: cleanings.id });
    return rows.length === 1;
  }

  async appendLifecycleEvent(
    event: CleaningLifecycleEvent,
    context: UnitOfWorkContext,
  ): Promise<void> {
    await this.transaction(context).insert(cleaningLifecycleEvents).values({
      id: event.id,
      cleaningId: event.cleaningId,
      eventType: event.eventType,
      actorUserId: event.actorUserId,
      occurredAt: event.occurredAt,
      recordedAt: event.recordedAt,
      version: event.version,
    });
  }

  private transaction(context: UnitOfWorkContext): DrizzleTransaction {
    return this.contextRegistry.get<DrizzleTransaction>(context);
  }
}
