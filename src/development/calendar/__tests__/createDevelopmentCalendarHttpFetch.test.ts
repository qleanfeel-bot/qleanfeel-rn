import type { HttpFetch, HttpResponse } from '../../../infrastructure/http/HttpTransport';
import { createDevelopmentCalendarHttpFetch } from '../createDevelopmentCalendarHttpFetch';

const BASE_URL = 'https://development.invalid';
const AUTHORIZATION = 'Bearer development-api-access-token';
const COLLECTION = '/v1/me/calendar/entries';
const SEED_ID = 'development-calendar-seed';
const SEED_ENTRY = {
  id: SEED_ID,
  startAt: '2026-10-05T07:00:00Z',
  endAt: '2026-10-05T10:00:00Z',
  type: 'personal',
  status: 'scheduled',
  title: 'Development calendar sample',
};

function send(
  handler: HttpFetch,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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

function rangePath(from: string, to: string): string {
  return `${COLLECTION}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

describe('development Calendar HTTP handler', () => {
  it('returns entries overlapping a valid requested range', async () => {
    const handler = createDevelopmentCalendarHttpFetch();
    const response = await send(
      handler,
      'GET',
      rangePath('2026-10-05T09:00:00Z', '2026-10-05T11:00:00Z'),
    );

    expect(response.status).toBe(200);
    await expect(read(response)).resolves.toEqual({ entries: [SEED_ENTRY] });
  });

  it.each([
    `${COLLECTION}?to=2026-10-06T00%3A00%3A00Z`,
    `${COLLECTION}?from=2026-10-05T00%3A00%3A00Z`,
  ])('requires both from and to in GET range %s', async path => {
    const response = await send(createDevelopmentCalendarHttpFetch(), 'GET', path);

    expect(response.status).toBe(400);
    await expect(read(response)).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it.each([
    ['equal', '2026-10-05T09:00:00Z', '2026-10-05T09:00:00Z'],
    ['reversed', '2026-10-05T10:00:00Z', '2026-10-05T09:00:00Z'],
  ])('rejects a GET range where from is not before to (%s)', async (_description, from, to) => {
    const response = await send(createDevelopmentCalendarHttpFetch(), 'GET', rangePath(from, to));

    expect(response.status).toBe(400);
    await expect(read(response)).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('uses half-open overlap semantics, including for adjacent entries', async () => {
    const handler = createDevelopmentCalendarHttpFetch();
    const adjacent = await send(handler, 'POST', COLLECTION, {
      startAt: '2026-10-05T10:00:00Z',
      endAt: '2026-10-05T11:00:00Z',
      type: 'blocked',
      title: 'Unavailable',
    });
    const created = await read(adjacent) as { id: string };

    const response = await send(
      handler,
      'GET',
      rangePath('2026-10-05T10:00:00Z', '2026-10-05T11:00:00Z'),
    );

    expect(response.status).toBe(200);
    await expect(read(response)).resolves.toMatchObject({ entries: [{ id: created.id }] });
  });

  it('returns an empty list when no entries overlap the requested range', async () => {
    const response = await send(
      createDevelopmentCalendarHttpFetch(),
      'GET',
      rangePath('2030-01-01T00:00:00Z', '2030-01-02T00:00:00Z'),
    );

    expect(response.status).toBe(200);
    await expect(read(response)).resolves.toEqual({ entries: [] });
  });

  it('reads an entry by id and returns ENTRY_NOT_FOUND for a missing id', async () => {
    const handler = createDevelopmentCalendarHttpFetch();
    const found = await send(handler, 'GET', `${COLLECTION}/${SEED_ID}`);
    expect(found.status).toBe(200);
    await expect(read(found)).resolves.toEqual(SEED_ENTRY);

    const missing = await send(handler, 'GET', `${COLLECTION}/missing`);
    expect(missing.status).toBe(404);
    await expect(read(missing)).resolves.toMatchObject({ error: { code: 'ENTRY_NOT_FOUND' } });
  });

  it('rejects deleting a CalendarEntry referenced by a ManualOrder and preserves the entry', async () => {
    const handler = createDevelopmentCalendarHttpFetch({
      isManualOrderReference: entryId => entryId === SEED_ID,
    });
    const deletion = await send(handler, 'DELETE', `${COLLECTION}/${SEED_ID}`);

    expect(deletion.status).toBe(409);
    await expect(read(deletion)).resolves.toMatchObject({
      error: { code: 'CALENDAR_CONFLICT' },
    });
    const stillPresent = await send(handler, 'GET', `${COLLECTION}/${SEED_ID}`);
    expect(stillPresent.status).toBe(200);
    await expect(read(stillPresent)).resolves.toEqual(SEED_ENTRY);
  });

  it('creates an entry with a generated id and server-assigned scheduled status', async () => {
    const response = await send(createDevelopmentCalendarHttpFetch(), 'POST', COLLECTION, {
      startAt: '2026-10-06T07:00:00Z',
      endAt: '2026-10-06T08:00:00Z',
      type: 'blocked',
      title: 'Unavailable',
    });
    const body = await read(response) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body).toEqual({
      id: 'development-calendar-entry-1',
      startAt: '2026-10-06T07:00:00Z',
      endAt: '2026-10-06T08:00:00Z',
      type: 'blocked',
      status: 'scheduled',
      title: 'Unavailable',
    });
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('ownership');
  });

  it.each(['id', 'status', 'userId', 'ownership'])(
    'rejects client-controlled create field %s',
    async field => {
      const input = {
        startAt: '2026-10-06T07:00:00Z',
        endAt: '2026-10-06T08:00:00Z',
        type: 'blocked',
        title: 'Unavailable',
        [field]: 'client-value',
      };
      const response = await send(createDevelopmentCalendarHttpFetch(), 'POST', COLLECTION, input);

      expect(response.status).toBe(400);
      await expect(read(response)).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    },
  );

  it.each([
    ['invalid UTC timestamp', { startAt: '2026-10-06T07:00:00+00:00' }],
    ['invalid interval', { startAt: '2026-10-06T08:00:00Z', endAt: '2026-10-06T08:00:00Z' }],
    ['invalid type', { type: 'other' }],
  ])('rejects create with %s', async (_description, overrides) => {
    const response = await send(createDevelopmentCalendarHttpFetch(), 'POST', COLLECTION, {
      startAt: '2026-10-06T07:00:00Z',
      endAt: '2026-10-06T08:00:00Z',
      type: 'blocked',
      title: 'Unavailable',
      ...overrides,
    });

    expect(response.status).toBe(400);
    await expect(read(response)).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it.each([
    ['startAt', '2026-10-05T08:00:00Z'],
    ['endAt', '2026-10-05T11:00:00Z'],
    ['type', 'blocked'],
    ['title', 'Changed title'],
  ] as const)('patches the allowed %s field', async (field, value) => {
    const handler = createDevelopmentCalendarHttpFetch();
    const response = await send(handler, 'PATCH', `${COLLECTION}/${SEED_ID}`, { [field]: value });
    const updated = await read(response) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(updated[field]).toBe(value);
    expect(updated.id).toBe(SEED_ID);
    expect(updated.status).toBe('scheduled');
  });

  it('supports partial PATCH updates and an empty title', async () => {
    const response = await send(
      createDevelopmentCalendarHttpFetch(),
      'PATCH',
      `${COLLECTION}/${SEED_ID}`,
      { title: '' },
    );
    const updated = await read(response) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(updated).toEqual({ ...SEED_ENTRY, title: '' });
  });

  it('rejects a PATCH that makes the resulting interval invalid without changing stored data', async () => {
    const handler = createDevelopmentCalendarHttpFetch();
    const invalid = await send(handler, 'PATCH', `${COLLECTION}/${SEED_ID}`, {
      startAt: '2026-10-05T10:00:00Z',
    });

    expect(invalid.status).toBe(400);
    await expect(read(invalid)).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });

    const unchanged = await send(
      handler,
      'GET',
      rangePath('2026-10-05T07:00:00Z', '2026-10-05T10:00:00Z'),
    );
    await expect(read(unchanged)).resolves.toEqual({ entries: [SEED_ENTRY] });
  });

  it.each(['id', 'status', 'userId', 'ownership'])(
    'rejects PATCH of protected field %s',
    async field => {
      const response = await send(
        createDevelopmentCalendarHttpFetch(),
        'PATCH',
        `${COLLECTION}/${SEED_ID}`,
        { [field]: 'client-value' },
      );

      expect(response.status).toBe(400);
      await expect(read(response)).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    },
  );

  it('returns 404 when PATCH targets a missing entry', async () => {
    const response = await send(
      createDevelopmentCalendarHttpFetch(),
      'PATCH',
      `${COLLECTION}/missing-entry`,
      { title: 'Changed' },
    );

    expect(response.status).toBe(404);
    await expect(read(response)).resolves.toMatchObject({ error: { code: 'ENTRY_NOT_FOUND' } });
  });

  it('deletes an existing entry with 204 and no content', async () => {
    const handler = createDevelopmentCalendarHttpFetch();
    const response = await send(handler, 'DELETE', `${COLLECTION}/${SEED_ID}`);

    expect(response.status).toBe(204);
    await expect(read(response)).resolves.toBeUndefined();
  });

  it('returns 404 for a missing and repeated DELETE', async () => {
    const handler = createDevelopmentCalendarHttpFetch();
    const first = await send(handler, 'DELETE', `${COLLECTION}/missing-entry`);
    expect(first.status).toBe(404);
    await expect(read(first)).resolves.toMatchObject({ error: { code: 'ENTRY_NOT_FOUND' } });

    const deleted = await send(handler, 'DELETE', `${COLLECTION}/${SEED_ID}`);
    expect(deleted.status).toBe(204);

    const repeated = await send(handler, 'DELETE', `${COLLECTION}/${SEED_ID}`);
    expect(repeated.status).toBe(404);
    await expect(read(repeated)).resolves.toMatchObject({ error: { code: 'ENTRY_NOT_FOUND' } });
  });

  it('returns the safe unauthorized error envelope for a missing token', async () => {
    const response = await send(
      createDevelopmentCalendarHttpFetch(),
      'GET',
      rangePath('2026-10-05T07:00:00Z', '2026-10-05T10:00:00Z'),
      undefined,
      null,
    );

    expect(response.status).toBe(401);
    await expect(read(response)).resolves.toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });
});
