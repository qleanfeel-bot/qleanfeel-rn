export const ORDER_ORIGINS = {
  MANUAL: 'manual',
  QLEANFEEL: 'qleanfeel',
  CLIENT: 'client',
} as const;

export type OrderOrigin = (typeof ORDER_ORIGINS)[keyof typeof ORDER_ORIGINS];

export const ORDER_STATUSES = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  PARTIALLY_FULFILLED: 'partially_fulfilled',
  FULFILLED: 'fulfilled',
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

export class Order {
  private constructor(
    readonly id: string,
    readonly origin: OrderOrigin,
    readonly createdByUserId: string,
    readonly status: OrderStatus,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly version: number,
  ) {}

  static createManual(
    id: string,
    createdByUserId: string,
    createdAt: Date,
  ): Order {
    if (!id.trim() || !createdByUserId.trim() || !isValidDate(createdAt)) {
      throw new InvalidOrderError();
    }

    return new Order(
      id,
      ORDER_ORIGINS.MANUAL,
      createdByUserId,
      ORDER_STATUSES.CONFIRMED,
      new Date(createdAt),
      new Date(createdAt),
      1,
    );
  }
}

export class InvalidOrderError extends Error {
  constructor() {
    super('Order is invalid.');
    this.name = 'InvalidOrderError';
  }
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}
