import type {
  CalendarEntryStatus,
  CalendarEntryType,
} from '../../../domain/calendar/calendar-entry.js';
import type { CleaningStatus } from '../../../domain/cleanings/cleaning.js';
import type { QuotedPrice } from '../../../domain/orders/order-terms.js';
import type { OrderOrigin, OrderStatus } from '../../../domain/orders/order.js';

export interface OrderReadPosition {
  readonly createdAt: Date;
  readonly id: string;
}

export interface OrderReadTerms {
  readonly id: string;
  readonly revision: number;
  readonly customerName: string;
  readonly customerPhone: string | null;
  readonly serviceDescription: string;
  readonly serviceAddress: string;
  readonly quotedPrice: QuotedPrice | null;
  readonly notes: string | null;
  readonly createdAt: Date;
}

export interface OrderReadCalendarEntry {
  readonly id: string;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly type: CalendarEntryType;
  readonly status: CalendarEntryStatus;
  readonly title: string;
}

export interface OrderReadCleaning {
  readonly id: string;
  readonly status: CleaningStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly calendarEntry: OrderReadCalendarEntry | null;
}

/** An application-facing joined view, not a hydrated domain aggregate. */
export interface OrderReadModel {
  readonly id: string;
  readonly ownerUserId: string;
  readonly origin: OrderOrigin;
  readonly status: OrderStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
  readonly terms: OrderReadTerms | null;
  readonly cleanings: readonly OrderReadCleaning[];
}

export abstract class OrderReadRepository {
  /** Returns at most `take` orders, already ordered newest first. */
  abstract listOwned(
    ownerUserId: string,
    before: OrderReadPosition | undefined,
    take: number,
  ): Promise<readonly OrderReadModel[]>;

  abstract findById(id: string): Promise<OrderReadModel | undefined>;
}
