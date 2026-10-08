import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
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
    const [row] = await this.transaction(context)
      .select({
        id: cleanings.id,
        orderId: cleanings.orderId,
        calendarEntryId: cleanings.calendarEntryId,
        status: cleanings.status,
        startedAt: cleanings.startedAt,
        completedAt: cleanings.completedAt,
        createdAt: cleanings.createdAt,
        updatedAt: cleanings.updatedAt,
        version: cleanings.version,
        orderOwnerUserId: orders.createdByUserId,
      })
      .from(cleanings)
      .innerJoin(orders, eq(cleanings.orderId, orders.id))
      .where(eq(cleanings.id, cleaningId))
      .limit(1);
    if (!row) return undefined;
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
      orderOwnerUserId: row.orderOwnerUserId,
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
