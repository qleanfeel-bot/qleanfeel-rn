import type { HttpFetch, HttpResponse } from '../../../infrastructure/http/HttpTransport';
import { createDevelopmentManualOrderHttpFetch } from '../createDevelopmentManualOrderHttpFetch';

const BASE_URL = 'https://development.invalid';
const AUTHORIZATION = 'Bearer development-api-access-token';
const COLLECTION = '/v1/me/manual-orders';
const input = {
  customerName: 'Ivan',
  serviceDescription: 'Cleaning',
  serviceAddress: 'Nevsky 25',
  calendarEntryId: 'entry-1',
};

function send(
  handler: HttpFetch,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  authorization: string | null = AUTHORIZATION,
): Promise<HttpResponse> {
  return handler(`${BASE_URL}${path}`, {
    method,
    headers: authorization === null ? {} : { Authorization: authorization },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function read(response: HttpResponse): Promise<unknown> {
  return response.json();
}

function createHandler(
  now: () => Date = () => new Date(),
  existingCalendarEntryIds: string[] = ['entry-1'],
): HttpFetch {
  const existingIds = new Set(existingCalendarEntryIds);
  return createDevelopmentManualOrderHttpFetch({
    calendarEntryExists: entryId => existingIds.has(entryId),
    onManualOrderCreated: jest.fn(),
  }, now);
}

describe('development ManualOrder HTTP handler', () => {
  it('returns an empty collection initially', async () => {
    const response = await send(createHandler(), 'GET', COLLECTION);
    expect(response.status).toBe(200);
    await expect(read(response)).resolves.toEqual({ orders: [] });
  });

  it('creates, lists, and gets an order with server-generated id and createdAt', async () => {
    const handler = createHandler(() => new Date('2026-10-01T10:00:00.000Z'));
    const created = await send(handler, 'POST', COLLECTION, input);
    const envelope = await read(created) as { order: Record<string, unknown> };

    expect(created.status).toBe(201);
    expect(envelope.order).toMatchObject({
      ...input,
      id: 'development-manual-order-1',
      createdAt: '2026-10-01T10:00:00.000Z',
      customerPhone: null,
      quotedPrice: null,
      notes: null,
    });
    const listed = await send(handler, 'GET', COLLECTION);
    await expect(read(listed)).resolves.toEqual({ orders: [envelope.order] });
    const fetched = await send(handler, 'GET', `${COLLECTION}/${String(envelope.order.id)}`);
    await expect(read(fetched)).resolves.toEqual(envelope);
  });

  it.each(['id', 'createdAt', 'userId', 'status', 'startAt', 'endAt'])(
    'rejects client-controlled or separately owned field %s', async field => {
      const response = await send(createHandler(), 'POST', COLLECTION, {
        ...input,
        [field]: 'client-value',
      });
      expect(response.status).toBe(400);
      await expect(read(response)).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    },
  );

  it('rejects empty fields, invalid optional price, and unknown request fields', async () => {
    const handler = createHandler();
    for (const body of [
      { ...input, customerName: '  ' },
      { ...input, quotedPrice: { amountMinor: 1.5, currencyCode: 'RUB' } },
      { ...input, unexpected: true },
    ]) {
      const response = await send(handler, 'POST', COLLECTION, body);
      expect(response.status).toBe(400);
    }
  });

  it('returns a safe not-found response for missing items and unknown routes', async () => {
    const handler = createHandler();
    const missing = await send(handler, 'GET', `${COLLECTION}/missing`);
    expect(missing.status).toBe(404);
    await expect(read(missing)).resolves.toMatchObject({ error: { code: 'ORDER_NOT_FOUND' } });
    expect((await send(handler, 'GET', `${COLLECTION}/one/two`)).status).toBe(404);
    expect((await send(handler, 'GET', '/v1/me/manual-orders-extra')).status).toBe(404);
  });

  it('requires the development authorization header', async () => {
    const response = await send(createHandler(), 'GET', COLLECTION, undefined, null);
    expect(response.status).toBe(401);
    await expect(read(response)).resolves.toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('rejects creating an order that references a missing CalendarEntry', async () => {
    const response = await send(createHandler(() => new Date(), []), 'POST', COLLECTION, input);

    expect(response.status).toBe(404);
    await expect(read(response)).resolves.toMatchObject({
      error: { code: 'CALENDAR_ENTRY_NOT_FOUND' },
    });
  });
});
