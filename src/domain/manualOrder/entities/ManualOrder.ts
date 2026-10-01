export interface QuotedPrice {
  readonly amountMinor: number;
  readonly currencyCode: string;
}

export interface ManualOrder {
  readonly id: string;
  readonly customerName: string;
  readonly serviceDescription: string;
  readonly serviceAddress: string;
  readonly calendarEntryId: string;
  readonly createdAt: string;
  readonly customerPhone: string | null;
  readonly quotedPrice: QuotedPrice | null;
  readonly notes: string | null;
}

export interface CreateManualOrderInput {
  readonly customerName: string;
  readonly serviceDescription: string;
  readonly serviceAddress: string;
  readonly calendarEntryId: string;
  readonly customerPhone?: string | null;
  readonly quotedPrice?: QuotedPrice | null;
  readonly notes?: string | null;
}

const DETAILS_FIELDS = [
  'customerName',
  'serviceDescription',
  'serviceAddress',
  'customerPhone',
  'quotedPrice',
  'notes',
];
const CREATE_FIELDS = [...DETAILS_FIELDS, 'calendarEntryId'];
const ENTITY_FIELDS = [...CREATE_FIELDS, 'id', 'createdAt'];

export type ManualOrderDetailsInput = Omit<CreateManualOrderInput, 'calendarEntryId'>;

/** Validates the order-owned fields before a calendar reference has been created. */
export function validateManualOrderDetailsInput(input: unknown): ManualOrderDetailsInput {
  if (!isRecord(input) || hasUnknownFields(input, DETAILS_FIELDS)) {
    throw new TypeError('Invalid ManualOrder input');
  }

  const customerName = requiredText(input.customerName);
  const serviceDescription = requiredText(input.serviceDescription);
  const serviceAddress = requiredText(input.serviceAddress);
  if (!customerName || !serviceDescription || !serviceAddress) {
    throw new TypeError('Invalid ManualOrder input');
  }

  const customerPhone = optionalText(input.customerPhone);
  const notes = optionalText(input.notes);
  const quotedPrice = parseQuotedPrice(input.quotedPrice);
  if (customerPhone === INVALID || notes === INVALID || quotedPrice === INVALID) {
    throw new TypeError('Invalid ManualOrder input');
  }

  return {
    customerName,
    serviceDescription,
    serviceAddress,
    customerPhone,
    quotedPrice,
    notes,
  };
}

/** Validates client-owned create fields and returns a normalized input. */
export function validateCreateManualOrderInput(input: unknown): CreateManualOrderInput {
  if (!isRecord(input) || hasUnknownFields(input, CREATE_FIELDS)) {
    throw new TypeError('Invalid ManualOrder input');
  }
  const details = validateManualOrderDetailsInput({
    customerName: input.customerName,
    serviceDescription: input.serviceDescription,
    serviceAddress: input.serviceAddress,
    customerPhone: input.customerPhone,
    quotedPrice: input.quotedPrice,
    notes: input.notes,
  });
  const calendarEntryId = requiredText(input.calendarEntryId);
  if (!calendarEntryId) {
    throw new TypeError('Invalid ManualOrder input');
  }
  return { ...details, calendarEntryId };
}

/** Creates a ManualOrder from a server response after checking domain invariants. */
export function createManualOrder(input: unknown): ManualOrder {
  if (!isRecord(input) || hasUnknownFields(input, ENTITY_FIELDS)) {
    throw new TypeError('Invalid ManualOrder');
  }

  const createInput = validateCreateManualOrderInput({
    customerName: input.customerName,
    serviceDescription: input.serviceDescription,
    serviceAddress: input.serviceAddress,
    calendarEntryId: input.calendarEntryId,
    customerPhone: input.customerPhone,
    quotedPrice: input.quotedPrice,
    notes: input.notes,
  });
  const id = requiredText(input.id);
  const createdAt = requiredText(input.createdAt);
  if (!id || !createdAt) {
    throw new TypeError('Invalid ManualOrder');
  }

  return {
    id,
    createdAt,
    ...createInput,
    customerPhone: createInput.customerPhone ?? null,
    quotedPrice: createInput.quotedPrice ?? null,
    notes: createInput.notes ?? null,
  };
}

const INVALID = Symbol('invalid');

function requiredText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function optionalText(value: unknown): string | null | typeof INVALID {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === 'string' ? value : INVALID;
}

function parseQuotedPrice(value: unknown): QuotedPrice | null | typeof INVALID {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value) || hasUnknownFields(value, ['amountMinor', 'currencyCode'])) {
    return INVALID;
  }
  const currencyCode = requiredText(value.currencyCode);
  if (
    typeof value.amountMinor !== 'number' ||
    !Number.isSafeInteger(value.amountMinor) ||
    value.amountMinor < 0 ||
    currencyCode === null ||
    !/^[A-Z]{3}$/.test(currencyCode)
  ) {
    return INVALID;
  }
  return { amountMinor: value.amountMinor, currencyCode };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasUnknownFields(value: Record<string, unknown>, allowedFields: string[]): boolean {
  return Object.keys(value).some(field => !allowedFields.includes(field));
}
