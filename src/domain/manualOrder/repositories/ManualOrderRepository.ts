import type {
  CreateManualOrderInput,
  ManualOrder,
} from '../entities/ManualOrder';

/** Application-facing access to the authenticated user's manual orders. */
export interface ManualOrderRepository {
  getOrders(): Promise<ManualOrder[]>;
  createOrder(order: CreateManualOrderInput): Promise<ManualOrder>;
  getOrder(orderId: string): Promise<ManualOrder>;
}
