import { BadRequestException } from '@nestjs/common';
import type { CreateManualOrderInput } from '../../application/orders/create-manual-order.js';

const requestFields = new Set([
  'customerName',
  'customerPhone',
  'serviceDescription',
  'serviceAddress',
  'quotedPrice',
  'notes',
  'schedule',
]);

export function readCreateManualOrderInput(
  body: unknown,
): CreateManualOrderInput {
  const value = asRecord(body, 'A valid order request is required.');
  assertOnlyFields(value, requestFields);
  const terms = {
    customerName: requiredText(value.customerName, 'customerName'),
    serviceDescription: requiredText(
      value.serviceDescription,
      'serviceDescription',
    ),
    serviceAddress: requiredText(value.serviceAddress, 'serviceAddress'),
    ...(optionalText(value.customerPhone, 'customerPhone') !== undefined
      ? { customerPhone: optionalText(value.customerPhone, 'customerPhone') }
      : {}),
    ...(optionalText(value.notes, 'notes') !== undefined
      ? { notes: optionalText(value.notes, 'notes') }
      : {}),
    ...(value.quotedPrice !== undefined
      ? { quotedPrice: readQuotedPrice(value.quotedPrice) }
      : {}),
  };
  if (value.schedule === undefined) return { terms };

  const schedule = asRecord(value.schedule, 'A valid schedule is required.');
  assertOnlyFields(schedule, new Set(['startAt', 'endAt']));
  return {
    terms,
    schedule: {
      startAt: requiredText(schedule.startAt, 'schedule.startAt'),
      endAt: requiredText(schedule.endAt, 'schedule.endAt'),
    },
  };
}

function readQuotedPrice(value: unknown) {
  const quote = asRecord(value, 'A valid quotedPrice is required.');
  assertOnlyFields(quote, new Set(['amountMinor', 'currencyCode']));
  if (
    typeof quote.amountMinor !== 'number' ||
    !Number.isSafeInteger(quote.amountMinor) ||
    quote.amountMinor < 0
  ) {
    throw new BadRequestException(
      'quotedPrice.amountMinor must be a non-negative integer.',
    );
  }
  return {
    amountMinor: quote.amountMinor,
    currencyCode: requiredText(quote.currencyCode, 'quotedPrice.currencyCode'),
  };
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException(message);
  }
  return value as Record<string, unknown>;
}

function assertOnlyFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): void {
  const unknown = Object.keys(value).find(key => !allowed.has(key));
  if (unknown) {
    throw new BadRequestException(`Unknown field: ${unknown}.`);
  }
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`${field} must be a non-empty string.`);
  }
  return value;
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string.`);
  }
  return value;
}
