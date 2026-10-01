import {
  createManualOrder,
  validateCreateManualOrderInput,
  type ManualOrder,
} from '../../domain/manualOrder/entities/ManualOrder';
import type { HttpFetch, HttpResponse } from '../../infrastructure/http/HttpTransport';

const COLLECTION_PATH = '/v1/me/manual-orders';
const DEVELOPMENT_AUTHORIZATION = 'Bearer development-api-access-token';

type ManualOrderErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CALENDAR_ENTRY_NOT_FOUND'
  | 'ORDER_NOT_FOUND'
  | 'INTERNAL_ERROR';

type ManualOrderErrorStatus = 400 | 401 | 403 | 404 | 500;

export interface DevelopmentManualOrderHttpFetchOptions {
  readonly calendarEntryExists: (entryId: string) => boolean;
  readonly onManualOrderCreated: (calendarEntryId: string) => void;
}

/** Development-only in-memory handler for the ManualOrder HTTP API. */
export function createDevelopmentManualOrderHttpFetch(
  options: DevelopmentManualOrderHttpFetchOptions,
  now: () => Date = () => new Date(),
): HttpFetch {
  const orders = new Map<string, ManualOrder>();
  let nextOrderId = 1;

  return async (url, init) => {
    try {
      const target = requestTarget(url);
      const queryIndex = target.indexOf('?');
      const path = queryIndex < 0 ? target : target.slice(0, queryIndex);
      const query = queryIndex < 0 ? '' : target.slice(queryIndex + 1);
      const isCollection = path === COLLECTION_PATH;
      const encodedOrderId = path.startsWith(`${COLLECTION_PATH}/`)
        ? path.slice(COLLECTION_PATH.length + 1)
        : '';
      const isOrder = encodedOrderId.length > 0 && !encodedOrderId.includes('/');

      if (!isCollection && !isOrder) {
        return errorResponse(404, 'ORDER_NOT_FOUND');
      }
      if (init.headers.Authorization !== DEVELOPMENT_AUTHORIZATION) {
        return errorResponse(401, 'UNAUTHORIZED');
      }

      if (isCollection && init.method === 'GET') {
        return query
          ? errorResponse(400, 'VALIDATION_ERROR')
          : response(200, { orders: [...orders.values()] });
      }
      if (isCollection && init.method === 'POST') {
        if (query) {
          return errorResponse(400, 'VALIDATION_ERROR');
        }
        const input = parseBody(init.body);
        try {
          const normalized = validateCreateManualOrderInput(input);
          if (!options.calendarEntryExists(normalized.calendarEntryId)) {
            return errorResponse(404, 'CALENDAR_ENTRY_NOT_FOUND');
          }
          const order = createManualOrder({
            ...normalized,
            id: `development-manual-order-${nextOrderId}`,
            createdAt: now().toISOString(),
          });
          orders.set(order.id, order);
          options.onManualOrderCreated(order.calendarEntryId);
          nextOrderId += 1;
          return response(201, { order });
        } catch {
          return errorResponse(400, 'VALIDATION_ERROR');
        }
      }
      if (isOrder && init.method === 'GET') {
        if (query) {
          return errorResponse(400, 'VALIDATION_ERROR');
        }
        let orderId: string;
        try {
          orderId = decodeURIComponent(encodedOrderId);
        } catch {
          return errorResponse(404, 'ORDER_NOT_FOUND');
        }
        const order = orders.get(orderId);
        return order ? response(200, { order }) : errorResponse(404, 'ORDER_NOT_FOUND');
      }

      return errorResponse(404, 'ORDER_NOT_FOUND');
    } catch {
      return errorResponse(500, 'INTERNAL_ERROR');
    }
  };
}

function parseBody(body: string | undefined): unknown {
  try {
    return JSON.parse(body ?? '');
  } catch {
    return null;
  }
}

function requestTarget(url: string): string {
  const schemeEnd = url.indexOf('://');
  const pathStart = schemeEnd < 0 ? -1 : url.indexOf('/', schemeEnd + 3);
  return pathStart < 0 ? '/' : url.slice(pathStart);
}

function errorResponse(status: ManualOrderErrorStatus, code: ManualOrderErrorCode): HttpResponse {
  const messages: Record<ManualOrderErrorCode, string> = {
    VALIDATION_ERROR: 'Manual order input is invalid.',
    UNAUTHORIZED: 'Authentication is required.',
    FORBIDDEN: 'Manual order access is not permitted.',
    CALENDAR_ENTRY_NOT_FOUND: 'The scheduled Calendar entry was not found.',
    ORDER_NOT_FOUND: 'Manual order was not found.',
    INTERNAL_ERROR: 'An unexpected error occurred.',
  };
  return response(status, { error: { code, message: messages[code] } });
}

function response(status: number, body?: unknown): HttpResponse {
  return { status, json: async () => body };
}
