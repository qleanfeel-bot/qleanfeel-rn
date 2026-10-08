import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CleaningReadRepository } from '../../application/cleanings/ports/cleaning-read-repository.js';
import { Cleaning } from '../../domain/cleanings/cleaning.js';
import type { CleaningStatus } from '../../domain/cleanings/cleaning.js';
import { CleaningLifecycleEvent } from '../../domain/cleanings/cleaning-lifecycle-event.js';
import type { CleaningLifecycleEventType } from '../../domain/cleanings/cleaning-lifecycle-event.js';
import { DRIZZLE_DATABASE } from './database.tokens.js';
import { cleaningLifecycleEvents, cleanings, orders } from './schema/index.js';

@Injectable()
export class PostgresCleaningReadRepository extends CleaningReadRepository {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: NodePgDatabase,
  ) {
    super();
  }

  async findById(cleaningId: string) {
    const [row] = await this.database
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

  async findLifecycleEvents(cleaningId: string) {
    const rows = await this.database
      .select()
      .from(cleaningLifecycleEvents)
      .where(eq(cleaningLifecycleEvents.cleaningId, cleaningId))
      .orderBy(
        asc(cleaningLifecycleEvents.occurredAt),
        asc(cleaningLifecycleEvents.version),
      );

    return rows.map(row =>
      CleaningLifecycleEvent.record(
        row.id,
        row.cleaningId,
        row.eventType as CleaningLifecycleEventType,
        row.actorUserId,
        row.occurredAt,
        row.recordedAt,
        row.version,
      ),
    );
  }
}
