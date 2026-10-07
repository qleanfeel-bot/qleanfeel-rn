import { BadRequestException } from '@nestjs/common';
import type { OrderReadPosition } from '../../application/orders/ports/order-read-repository.js';
import {
  DEFAULT_MY_ORDERS_LIMIT,
  MAX_MY_ORDERS_LIMIT,
} from '../../application/orders/list-my-orders.js';

export interface ListMyOrdersHttpQuery {
  readonly limit: number;
  readonly before?: OrderReadPosition;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readListMyOrdersQuery(
  query: Record<string, unknown>,
): ListMyOrdersHttpQuery {
  const unknown = Object.keys(query).find(
    key => key !== 'limit' && key !== 'cursor',
  );
  if (unknown)
    throw new BadRequestException(`Unknown query parameter: ${unknown}.`);

  let limit = DEFAULT_MY_ORDERS_LIMIT;
  if (query.limit !== undefined) {
    if (typeof query.limit !== 'string' || !/^[1-9]\d*$/.test(query.limit)) {
      throw new BadRequestException('limit must be a positive integer.');
    }
    limit = Number(query.limit);
    if (!Number.isSafeInteger(limit) || limit > MAX_MY_ORDERS_LIMIT) {
      throw new BadRequestException(
        `limit must not exceed ${MAX_MY_ORDERS_LIMIT}.`,
      );
    }
  }

  return {
    limit,
    ...(query.cursor !== undefined
      ? { before: decodeCursor(query.cursor) }
      : {}),
  };
}

export function encodeOrderCursor(position: OrderReadPosition): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: position.createdAt.toISOString(),
      id: position.id,
    }),
  ).toString('base64url');
}

function decodeCursor(value: unknown): OrderReadPosition {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    throw new BadRequestException('cursor is invalid.');
  }
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const record: unknown = JSON.parse(decoded);
    if (
      typeof record !== 'object' ||
      record === null ||
      Array.isArray(record) ||
      !('createdAt' in record) ||
      !('id' in record) ||
      typeof record.createdAt !== 'string' ||
      typeof record.id !== 'string' ||
      !UUID_PATTERN.test(record.id)
    ) {
      throw new Error('Invalid cursor payload.');
    }
    const instant = new Date(record.createdAt);
    if (
      !Number.isFinite(instant.getTime()) ||
      instant.toISOString() !== record.createdAt
    ) {
      throw new Error('Invalid cursor timestamp.');
    }
    return { createdAt: instant, id: record.id };
  } catch {
    throw new BadRequestException('cursor is invalid.');
  }
}
