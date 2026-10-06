export interface QuotedPrice {
  readonly amountMinor: number;
  readonly currencyCode: string;
}

export interface OrderTermsInput {
  readonly customerName: string;
  readonly customerPhone?: string | null;
  readonly serviceDescription: string;
  readonly serviceAddress: string;
  readonly quotedPrice?: QuotedPrice | null;
  readonly notes?: string | null;
}

export class OrderTerms {
  private constructor(
    readonly id: string,
    readonly orderId: string,
    readonly revision: number,
    readonly customerName: string,
    readonly customerPhone: string | null,
    readonly serviceDescription: string,
    readonly serviceAddress: string,
    readonly quotedPrice: QuotedPrice | null,
    readonly notes: string | null,
    readonly createdAt: Date,
  ) {}

  static createInitial(
    id: string,
    orderId: string,
    input: OrderTermsInput,
    createdAt: Date,
  ): OrderTerms {
    if (
      !id.trim() ||
      !orderId.trim() ||
      !isValidDate(createdAt) ||
      !isNonEmptyText(input.customerName) ||
      !isNonEmptyText(input.serviceDescription) ||
      !isNonEmptyText(input.serviceAddress) ||
      !isOptionalText(input.customerPhone) ||
      !isOptionalText(input.notes) ||
      !isValidQuotedPrice(input.quotedPrice)
    ) {
      throw new InvalidOrderTermsError();
    }

    return new OrderTerms(
      id,
      orderId,
      1,
      input.customerName.trim(),
      input.customerPhone?.trim() || null,
      input.serviceDescription.trim(),
      input.serviceAddress.trim(),
      input.quotedPrice ? { ...input.quotedPrice } : null,
      input.notes?.trim() || null,
      new Date(createdAt),
    );
  }
}

export class InvalidOrderTermsError extends Error {
  constructor() {
    super('Order terms are invalid.');
    this.name = 'InvalidOrderTermsError';
  }
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalText(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function isValidQuotedPrice(
  value: unknown,
): value is QuotedPrice | null | undefined {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;

  const quotedPrice = value as Record<string, unknown>;
  return (
    Object.keys(quotedPrice).length === 2 &&
    Object.hasOwn(quotedPrice, 'amountMinor') &&
    Object.hasOwn(quotedPrice, 'currencyCode') &&
    typeof quotedPrice.amountMinor === 'number' &&
    Number.isSafeInteger(quotedPrice.amountMinor) &&
    quotedPrice.amountMinor >= 0 &&
    typeof quotedPrice.currencyCode === 'string' &&
    /^[A-Z]{3}$/.test(quotedPrice.currencyCode)
  );
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}
