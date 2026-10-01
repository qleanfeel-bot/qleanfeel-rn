import type {
  CreateManualOrderInput,
  ManualOrder,
} from '../../domain/manualOrder/entities/ManualOrder';
import type { ManualOrderRepository } from '../../domain/manualOrder/repositories/ManualOrderRepository';

/** Application operations for listing and managing manual order records. */
export class ManualOrderService {
  public constructor(private readonly orders: ManualOrderRepository) {}

  public getOrders(): Promise<ManualOrder[]> {
    return this.orders.getOrders();
  }

  public create(order: CreateManualOrderInput): Promise<ManualOrder> {
    return this.orders.createOrder(order);
  }

  public get(orderId: string): Promise<ManualOrder> {
    return this.orders.getOrder(orderId);
  }
}
