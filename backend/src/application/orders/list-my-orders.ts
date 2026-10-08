import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';
import {
  OrderReadRepository,
  type OrderReadModel,
  type OrderReadPosition,
} from './ports/order-read-repository.js';

export const DEFAULT_MY_ORDERS_LIMIT = 20;
export const MAX_MY_ORDERS_LIMIT = 100;

export interface ListMyOrdersInput {
  readonly limit: number;
  readonly before?: OrderReadPosition;
}

export interface ListMyOrdersResult {
  readonly items: readonly OrderReadModel[];
  readonly nextPosition?: OrderReadPosition;
}

export class InvalidOrderListLimitError extends Error {
  constructor() {
    super('Order list limit is invalid.');
    this.name = 'InvalidOrderListLimitError';
  }
}

export class ListMyOrders {
  constructor(private readonly orders: OrderReadRepository) {}

  async execute(
    principal: AuthenticatedPrincipal,
    input: ListMyOrdersInput,
  ): Promise<ListMyOrdersResult> {
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > MAX_MY_ORDERS_LIMIT
    ) {
      throw new InvalidOrderListLimitError();
    }

    const fetched = await this.orders.listOwned(
      principal.userId,
      input.before,
      input.limit + 1,
    );
    const hasMore = fetched.length > input.limit;
    const items = hasMore ? fetched.slice(0, input.limit) : fetched;
    const last = items.at(-1);

    return {
      items,
      ...(hasMore && last
        ? { nextPosition: { createdAt: last.createdAt, id: last.id } }
        : {}),
    };
  }
}
