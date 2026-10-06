import type { UnitOfWorkContext } from '../../ports/unit-of-work.js';
import type { Cleaning } from '../../../domain/cleanings/cleaning.js';
import type { OrderTerms } from '../../../domain/orders/order-terms.js';
import type { Order } from '../../../domain/orders/order.js';

export abstract class OrderRepository {
  abstract create(order: Order, context: UnitOfWorkContext): Promise<void>;
}

export abstract class OrderTermsRepository {
  abstract create(terms: OrderTerms, context: UnitOfWorkContext): Promise<void>;
}

export abstract class CleaningRepository {
  abstract create(
    cleaning: Cleaning,
    context: UnitOfWorkContext,
  ): Promise<void>;
  abstract associateCalendarEntry(
    cleaning: Cleaning,
    context: UnitOfWorkContext,
  ): Promise<void>;
}
