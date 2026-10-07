import type { AuthorizationDecision } from '../authorization/authorization-decision.js';
import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';
import { OrderReadPolicy } from './order-read-policy.js';
import { OrderReadRepository } from './ports/order-read-repository.js';
import type { OrderReadModel } from './ports/order-read-repository.js';

export class MyOrderNotFoundError extends Error {
  constructor() {
    super('Order was not found.');
    this.name = 'MyOrderNotFoundError';
  }
}

export class GetMyOrder {
  constructor(
    private readonly orders: OrderReadRepository,
    private readonly policy: OrderReadPolicy,
  ) {}

  async execute(
    principal: AuthenticatedPrincipal,
    id: string,
  ): Promise<OrderReadModel> {
    const order = await this.orders.findById(id);
    if (!order) throw new MyOrderNotFoundError();

    const decision: AuthorizationDecision = this.policy.evaluate(
      principal,
      'read_order',
      { ownerUserId: order.ownerUserId },
    );
    if (decision.outcome !== 'permit') {
      // Hide whether a non-owned Order exists.
      throw new MyOrderNotFoundError();
    }
    return order;
  }
}
