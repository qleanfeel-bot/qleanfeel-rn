import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { IdentityProofVerifier } from '../../src/application/identity/ports/identity-proof-verifier.js';
import { InvalidIdentityProofError } from '../../src/application/identity/identity-errors.js';
import { configureApi } from '../../src/http/configure-api.js';
import { POSTGRES_POOL } from '../../src/infrastructure/persistence/database.tokens.js';
import { BACKEND_CONFIG } from '../../src/shared/config/backend-config.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'Set TEST_DATABASE_URL to a dedicated PostgreSQL 18 test database before running test:postgres.',
  );
}

process.env.APP_ENV ??= 'test';
process.env.DATABASE_URL ??= testDatabaseUrl;

interface OrderTestContext {
  readonly app: Awaited<ReturnType<typeof createOrderApplication>>['app'];
  readonly pool: Pool;
  readonly bootstrap: (prefix: string) => Promise<{
    readonly userId: string;
    readonly accessToken: string;
  }>;
  readonly close: () => Promise<void>;
}

async function createOrderApplication() {
  const pool = new Pool({ connectionString: testDatabaseUrl, max: 5 });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(BACKEND_CONFIG)
    .useValue({
      environment: 'test',
      port: 3000,
      databaseUrl: testDatabaseUrl,
      databasePoolMax: 5,
      firebaseProjectId: 'order-integration-test',
      accessTokenSigningSecret:
        'postgres-order-test-signing-secret-at-least-32-bytes',
      authAccessTokenTtlSeconds: 300,
      authRefreshTokenTtlSeconds: 2_592_000,
    })
    .overrideProvider(POSTGRES_POOL)
    .useValue(pool)
    .overrideProvider(IdentityProofVerifier)
    .useValue({
      verify: async (credential: string) => {
        if (credential === 'invalid-proof') {
          throw new InvalidIdentityProofError();
        }
        return {
          provider: 'firebase',
          providerSubject: credential.replace(/^proof:/, ''),
        };
      },
    })
    .compile();
  const app = moduleRef.createNestApplication();
  configureApi(app);
  await app.init();

  const subjects = new Set<string>();
  return {
    app,
    pool,
    async bootstrap(prefix: string) {
      const subject = `${prefix}-${randomBytes(12).toString('hex')}`;
      subjects.add(subject);
      const response = await request(app.getHttpServer())
        .post('/v1/auth/bootstrap')
        .send({ firebaseIdToken: `proof:${subject}` })
        .expect(200);
      return {
        userId: response.body.user.id as string,
        accessToken: response.body.accessToken as string,
      };
    },
    async close() {
      for (const subject of subjects) {
        await deleteOrderTestUser(pool, subject);
      }
      await app.close();
    },
  };
}

async function deleteOrderTestUser(pool: Pool, subject: string) {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT user_id AS id FROM qleanfeel.auth_identities
     WHERE provider = 'firebase' AND provider_subject = $1`,
    [subject],
  );
  const userIds = rows.map(row => row.id);
  if (!userIds.length) return;
  await pool.query(
    `DELETE FROM qleanfeel.cleaning_lifecycle_events
     WHERE actor_user_id = ANY($1::uuid[])
        OR cleaning_id IN (
          SELECT c.id FROM qleanfeel.cleanings c
          JOIN qleanfeel.orders o ON o.id = c.order_id
          WHERE o.created_by_user_id = ANY($1::uuid[])
        )`,
    [userIds],
  );
  await pool.query(
    `DELETE FROM qleanfeel.cleanings
     WHERE order_id IN (SELECT id FROM qleanfeel.orders WHERE created_by_user_id = ANY($1::uuid[]))`,
    [userIds],
  );
  await pool.query(
    'DELETE FROM qleanfeel.calendar_entries WHERE owner_user_id = ANY($1::uuid[])',
    [userIds],
  );
  await pool.query(
    `DELETE FROM qleanfeel.order_terms
     WHERE order_id IN (SELECT id FROM qleanfeel.orders WHERE created_by_user_id = ANY($1::uuid[]))`,
    [userIds],
  );
  await pool.query(
    'DELETE FROM qleanfeel.orders WHERE created_by_user_id = ANY($1::uuid[])',
    [userIds],
  );
  await pool.query(
    `UPDATE qleanfeel.session_refresh_tokens SET replaced_by_id = NULL
     WHERE session_id IN (SELECT id FROM qleanfeel.auth_sessions WHERE user_id = ANY($1::uuid[]))`,
    [userIds],
  );
  await pool.query(
    `DELETE FROM qleanfeel.session_refresh_tokens
     WHERE session_id IN (SELECT id FROM qleanfeel.auth_sessions WHERE user_id = ANY($1::uuid[]))`,
    [userIds],
  );
  await pool.query(
    'DELETE FROM qleanfeel.auth_sessions WHERE user_id = ANY($1::uuid[])',
    [userIds],
  );
  await pool.query(
    'DELETE FROM qleanfeel.auth_identities WHERE user_id = ANY($1::uuid[])',
    [userIds],
  );
  await pool.query('DELETE FROM qleanfeel.users WHERE id = ANY($1::uuid[])', [
    userIds,
  ]);
}

async function withOrderApplication(
  operation: (context: OrderTestContext) => Promise<void>,
): Promise<void> {
  const context = await createOrderApplication();
  try {
    await operation(context);
  } finally {
    await context.close();
  }
}

function validRequest() {
  return {
    customerName: 'Customer Name',
    customerPhone: '+15550000000',
    serviceDescription: 'Home cleaning',
    serviceAddress: '10 Main Street',
    quotedPrice: { amountMinor: 12500, currencyCode: 'USD' },
    notes: 'Please call on arrival',
  };
}

test('production POST /v1/me/orders persists unscheduled and scheduled canonical graphs', async () => {
  await withOrderApplication(async ({ app, pool, bootstrap }) => {
    await request(app.getHttpServer())
      .post('/v1/me/orders')
      .send(validRequest())
      .expect(401);

    const { userId, accessToken } = await bootstrap('orders-success');
    const authorization = { Authorization: `Bearer ${accessToken}` };

    await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set(authorization)
      .send({ ...validRequest(), createdByUserId: userId })
      .expect(400);
    await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set(authorization)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set(authorization)
      .send({
        ...validRequest(),
        schedule: {
          startAt: '2026-10-06T11:00:00.000Z',
          endAt: '2026-10-06T10:00:00.000Z',
        },
      })
      .expect(400);

    const countsBeforeWrites = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM qleanfeel.orders WHERE created_by_user_id = $1',
      [userId],
    );
    assert.equal(countsBeforeWrites.rows[0]?.count, '0');

    const unscheduled = await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set(authorization)
      .send(validRequest())
      .expect(201);
    assert.equal(unscheduled.body.order.origin, 'manual');
    assert.equal(unscheduled.body.order.createdByUserId, userId);
    assert.equal(unscheduled.body.order.status, 'confirmed');
    assert.equal(unscheduled.body.order.version, 1);
    assert.equal(unscheduled.body.order.terms.revision, 1);
    assert.equal(unscheduled.body.order.terms.quotedPrice.amountMinor, 12500);
    assert.equal(unscheduled.body.initialCleaning.status, 'planned');
    assert.equal(unscheduled.body.initialCleaning.calendarEntryId, null);
    assert.equal(unscheduled.body.calendarEntry, null);

    const scheduled = await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set(authorization)
      .send({
        ...validRequest(),
        schedule: {
          startAt: '2026-10-07T10:00:00.000Z',
          endAt: '2026-10-07T11:00:00.000Z',
        },
      })
      .expect(201);
    assert.equal(
      scheduled.body.initialCleaning.calendarEntryId,
      scheduled.body.calendarEntry.id,
    );
    assert.equal(scheduled.body.calendarEntry.ownerUserId, userId);
    assert.equal(scheduled.body.calendarEntry.status, 'scheduled');

    const graph = await pool.query<{
      order_origin: string;
      order_status: string;
      creator_id: string;
      terms_revision: number;
      quoted_price_amount_minor: string;
      cleaning_status: string;
      calendar_entry_id: string | null;
      calendar_owner_id: string | null;
    }>(
      `SELECT o.origin AS order_origin, o.status AS order_status,
              o.created_by_user_id AS creator_id, t.revision AS terms_revision,
              t.quoted_price_amount_minor::text AS quoted_price_amount_minor,
              c.status AS cleaning_status, c.calendar_entry_id,
              e.owner_user_id AS calendar_owner_id
       FROM qleanfeel.orders o
       JOIN qleanfeel.order_terms t ON t.order_id = o.id
       JOIN qleanfeel.cleanings c ON c.order_id = o.id
       LEFT JOIN qleanfeel.calendar_entries e ON e.id = c.calendar_entry_id
       WHERE o.id = ANY($1::uuid[])
       ORDER BY o.created_at, o.id`,
      [[unscheduled.body.order.id, scheduled.body.order.id]],
    );
    assert.equal(graph.rows.length, 2);
    const unscheduledGraph = graph.rows.find(
      row => row.calendar_entry_id === null,
    );
    const scheduledGraph = graph.rows.find(
      row => row.calendar_entry_id !== null,
    );
    assert.ok(unscheduledGraph);
    assert.ok(scheduledGraph);
    assert.equal(unscheduledGraph.creator_id, userId);
    assert.equal(unscheduledGraph.order_origin, 'manual');
    assert.equal(unscheduledGraph.order_status, 'confirmed');
    assert.equal(unscheduledGraph.terms_revision, 1);
    assert.equal(unscheduledGraph.quoted_price_amount_minor, '12500');
    assert.equal(unscheduledGraph.cleaning_status, 'planned');
    assert.equal(unscheduledGraph.calendar_owner_id, null);
    assert.equal(
      scheduledGraph.calendar_entry_id,
      scheduled.body.calendarEntry.id,
    );
    assert.equal(scheduledGraph.calendar_owner_id, userId);

    const perOrderCleaningCounts = await pool.query<{
      order_id: string;
      count: string;
    }>(
      `SELECT order_id, count(*)::text AS count FROM qleanfeel.cleanings
       WHERE order_id = ANY($1::uuid[]) GROUP BY order_id`,
      [[unscheduled.body.order.id, scheduled.body.order.id]],
    );
    assert.deepEqual(
      perOrderCleaningCounts.rows.map(row => row.count),
      ['1', '1'],
    );
    const tableShape = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'qleanfeel' AND table_name = 'calendar_entries'`,
    );
    assert.equal(
      tableShape.rows.some(row => row.column_name === 'order_id'),
      false,
    );
    assert.equal(
      tableShape.rows.some(row => row.column_name === 'cleaning_id'),
      false,
    );
  });
});

test('suspended account is forbidden by the existing Qleanfeel authentication boundary', async () => {
  await withOrderApplication(async ({ app, pool, bootstrap }) => {
    const { userId, accessToken } = await bootstrap('orders-suspended');
    await pool.query(
      "UPDATE qleanfeel.users SET status = 'suspended' WHERE id = $1",
      [userId],
    );
    await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send(validRequest())
      .expect(403);
  });
});

test('failure after CalendarEntry insertion rolls back the complete order transaction', async () => {
  await withOrderApplication(async ({ app, pool, bootstrap }) => {
    const { userId, accessToken } = await bootstrap('orders-rollback');
    await pool.query(
      'DROP TRIGGER IF EXISTS reject_test_calendar_insert ON qleanfeel.calendar_entries',
    );
    await pool.query(
      'DROP FUNCTION IF EXISTS qleanfeel.reject_test_calendar_insert()',
    );
    await pool.query(`
      CREATE OR REPLACE FUNCTION qleanfeel.reject_test_calendar_insert()
      RETURNS trigger LANGUAGE plpgsql AS $body$
      BEGIN
        IF NEW.owner_user_id = '${userId}'::uuid THEN
          RAISE EXCEPTION 'forced CalendarEntry integration failure';
        END IF;
        RETURN NEW;
      END
      $body$`);
    await pool.query(`
      CREATE TRIGGER reject_test_calendar_insert
      AFTER INSERT ON qleanfeel.calendar_entries
      FOR EACH ROW EXECUTE FUNCTION qleanfeel.reject_test_calendar_insert()`);
    try {
      await request(app.getHttpServer())
        .post('/v1/me/orders')
        .set({ Authorization: `Bearer ${accessToken}` })
        .send({
          ...validRequest(),
          schedule: {
            startAt: '2026-10-08T10:00:00.000Z',
            endAt: '2026-10-08T11:00:00.000Z',
          },
        })
        .expect(500);
    } finally {
      await pool.query(
        'DROP TRIGGER IF EXISTS reject_test_calendar_insert ON qleanfeel.calendar_entries',
      );
      await pool.query(
        'DROP FUNCTION IF EXISTS qleanfeel.reject_test_calendar_insert()',
      );
    }

    const persisted = await pool.query<{ table_name: string; count: string }>(
      `SELECT 'orders' AS table_name, count(*)::text AS count
         FROM qleanfeel.orders WHERE created_by_user_id = $1
       UNION ALL
       SELECT 'terms', count(*)::text FROM qleanfeel.order_terms t
         JOIN qleanfeel.orders o ON o.id = t.order_id WHERE o.created_by_user_id = $1
       UNION ALL
       SELECT 'cleanings', count(*)::text FROM qleanfeel.cleanings c
         JOIN qleanfeel.orders o ON o.id = c.order_id WHERE o.created_by_user_id = $1
       UNION ALL
       SELECT 'calendar_entries', count(*)::text
         FROM qleanfeel.calendar_entries WHERE owner_user_id = $1`,
      [userId],
    );
    assert.deepEqual(
      persisted.rows.map(({ table_name, count }) => [table_name, count]),
      [
        ['orders', '0'],
        ['terms', '0'],
        ['cleanings', '0'],
        ['calendar_entries', '0'],
      ],
    );
  });
});

test('production order read endpoints enforce ownership and return deterministic cursor pages', async () => {
  await withOrderApplication(async ({ app, pool, bootstrap }) => {
    const userA = await bootstrap('orders-read-a');
    const userB = await bootstrap('orders-read-b');
    const authA = { Authorization: `Bearer ${userA.accessToken}` };
    const authB = { Authorization: `Bearer ${userB.accessToken}` };

    await request(app.getHttpServer()).get('/v1/me/orders').expect(401);
    const a1 = await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set(authA)
      .send(validRequest())
      .expect(201);
    const a2 = await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set(authA)
      .send({
        ...validRequest(),
        schedule: {
          startAt: '2026-10-09T10:00:00.000Z',
          endAt: '2026-10-09T11:00:00.000Z',
        },
      })
      .expect(201);
    const b1 = await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set(authB)
      .send(validRequest())
      .expect(201);

    const createdAt = '2026-10-05T12:00:00.000Z';
    await pool.query(
      `UPDATE qleanfeel.orders SET created_at = $1, updated_at = $1
       WHERE id = ANY($2::uuid[])`,
      [createdAt, [a1.body.order.id, a2.body.order.id]],
    );
    await pool.query(
      `INSERT INTO qleanfeel.order_terms
       (id, order_id, revision, customer_name, customer_phone,
        service_description, service_address, quoted_price_amount_minor,
        quoted_price_currency_code, notes, created_at)
       VALUES ($1, $2, 2, 'Revision Two', NULL, 'Revised service',
        '2 New Address', NULL, NULL, NULL, $3)`,
      [randomUUID(), a2.body.order.id, createdAt],
    );
    const extraCleaningId = randomUUID();
    await pool.query(
      `INSERT INTO qleanfeel.cleanings
       (id, order_id, status, calendar_entry_id, created_at, updated_at, version)
       VALUES ($1, $2, 'planned', NULL, $3, $3, 1)`,
      [extraCleaningId, a2.body.order.id, createdAt],
    );

    const aList = await request(app.getHttpServer())
      .get('/v1/me/orders?limit=1')
      .set(authA)
      .expect(200);
    const expectedOrderIds = [a1.body.order.id, a2.body.order.id].sort(
      (left: string, right: string) => right.localeCompare(left),
    );
    assert.equal(aList.body.items.length, 1);
    assert.equal(aList.body.items[0].id, expectedOrderIds[0]);
    assert.equal('ownerUserId' in aList.body.items[0], false);
    assert.ok(aList.body.nextCursor);
    const aNext = await request(app.getHttpServer())
      .get(
        `/v1/me/orders?limit=1&cursor=${encodeURIComponent(aList.body.nextCursor)}`,
      )
      .set(authA)
      .expect(200);
    assert.equal(aNext.body.items.length, 1);
    assert.equal(aNext.body.items[0].id, expectedOrderIds[1]);
    assert.equal(aNext.body.nextCursor, null);
    assert.notEqual(aList.body.items[0].id, aNext.body.items[0].id);
    const a2Item = [aList.body.items[0], aNext.body.items[0]].find(
      (item: { id: string }) => item.id === a2.body.order.id,
    );
    assert.ok(a2Item);
    assert.equal(a2Item.terms.revision, 2);
    assert.equal(a2Item.terms.customerName, 'Revision Two');
    assert.equal(a2Item.cleanings.length, 2);
    assert.ok(
      a2Item.cleanings.some(
        (cleaning: { id: string }) => cleaning.id === extraCleaningId,
      ),
    );
    assert.equal(
      a2Item.cleanings.find(
        (cleaning: { calendarEntry: unknown }) =>
          cleaning.calendarEntry !== null,
      )?.calendarEntry.status,
      'scheduled',
    );

    const bList = await request(app.getHttpServer())
      .get('/v1/me/orders')
      .set(authB)
      .expect(200);
    assert.deepEqual(
      bList.body.items.map((item: { id: string }) => item.id),
      [b1.body.order.id],
    );
    const detail = await request(app.getHttpServer())
      .get(`/v1/me/orders/${a2.body.order.id}`)
      .set(authA)
      .expect(200);
    assert.equal(detail.body.id, a2.body.order.id);
    assert.equal(detail.body.terms.revision, 2);
    assert.equal(detail.body.cleanings.length, 2);
    assert.equal('ownerUserId' in detail.body, false);
    const foreign = await request(app.getHttpServer())
      .get(`/v1/me/orders/${b1.body.order.id}`)
      .set(authA)
      .expect(404);
    const missing = await request(app.getHttpServer())
      .get(`/v1/me/orders/${randomUUID()}`)
      .set(authA)
      .expect(404);
    assert.equal(foreign.body.message, missing.body.message);

    await request(app.getHttpServer())
      .get('/v1/me/orders?userId=' + userB.userId)
      .set(authA)
      .expect(400);
    await request(app.getHttpServer())
      .get('/v1/me/orders?limit=0')
      .set(authA)
      .expect(400);
    await request(app.getHttpServer())
      .get('/v1/me/orders?cursor=not-a-cursor')
      .set(authA)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/v1/me/orders/${b1.body.order.id}`)
      .expect(401);

    const emptyUser = await bootstrap('orders-read-empty');
    const empty = await request(app.getHttpServer())
      .get('/v1/me/orders')
      .set({ Authorization: `Bearer ${emptyUser.accessToken}` })
      .expect(200);
    assert.deepEqual(empty.body, { items: [], nextCursor: null });
  });
});

test('Cleaning lifecycle commands persist execution state without changing Order or Calendar state', async () => {
  await withOrderApplication(async ({ app, pool, bootstrap }) => {
    const owner = await bootstrap('cleaning-lifecycle-owner');
    const other = await bootstrap('cleaning-lifecycle-other');
    const ownerAuth = { Authorization: `Bearer ${owner.accessToken}` };
    const otherAuth = { Authorization: `Bearer ${other.accessToken}` };

    const createCleaning = async (schedule?: {
      startAt: string;
      endAt: string;
    }) => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/orders')
        .set(ownerAuth)
        .send({
          ...validRequest(),
          ...(schedule ? { schedule } : {}),
        })
        .expect(201);
      return {
        orderId: response.body.order.id as string,
        cleaningId: response.body.initialCleaning.id as string,
        calendarEntryId: response.body.calendarEntry?.id as string | undefined,
      };
    };

    const completed = await createCleaning({
      startAt: '2026-10-09T10:00:00.000Z',
      endAt: '2026-10-09T11:00:00.000Z',
    });
    await request(app.getHttpServer())
      .get(`/v1/me/cleanings/${completed.cleaningId}`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/v1/me/cleanings/${completed.cleaningId}/lifecycle`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/v1/me/cleanings/${completed.cleaningId}`)
      .set(otherAuth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/v1/me/cleanings/${completed.cleaningId}/lifecycle`)
      .set(otherAuth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/v1/me/cleanings/${randomUUID()}`)
      .set(ownerAuth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/v1/me/cleanings/${randomUUID()}/lifecycle`)
      .set(ownerAuth)
      .expect(404);
    await request(app.getHttpServer())
      .get('/v1/me/cleanings/not-a-uuid')
      .set(ownerAuth)
      .expect(400);
    const initialRead = await request(app.getHttpServer())
      .get(`/v1/me/cleanings/${completed.cleaningId}`)
      .set(ownerAuth)
      .expect(200);
    assert.equal(initialRead.body.id, completed.cleaningId);
    assert.equal(initialRead.body.orderId, completed.orderId);
    assert.equal(initialRead.body.calendarEntryId, completed.calendarEntryId);
    assert.equal(initialRead.body.status, 'planned');
    assert.equal(initialRead.body.startedAt, null);
    assert.equal(initialRead.body.completedAt, null);
    assert.equal(initialRead.body.version, 1);
    const emptyLifecycle = await request(app.getHttpServer())
      .get(`/v1/me/cleanings/${completed.cleaningId}/lifecycle`)
      .set(ownerAuth)
      .expect(200);
    assert.deepEqual(emptyLifecycle.body, { items: [] });

    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${completed.cleaningId}/start`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${completed.cleaningId}/start`)
      .set(otherAuth)
      .expect(404);
    const suspended = await bootstrap('cleaning-lifecycle-suspended');
    await pool.query(
      "UPDATE qleanfeel.users SET status = 'suspended' WHERE id = $1",
      [suspended.userId],
    );
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${completed.cleaningId}/start`)
      .set({ Authorization: `Bearer ${suspended.accessToken}` })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${randomUUID()}/start`)
      .set(ownerAuth)
      .expect(404);
    await request(app.getHttpServer())
      .post('/v1/me/cleanings/not-a-uuid/start')
      .set(ownerAuth)
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${completed.cleaningId}/start`)
      .set(ownerAuth)
      .send({ status: 'completed' })
      .expect(400);

    const started = await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${completed.cleaningId}/start`)
      .set(ownerAuth)
      .expect(200);
    assert.equal(started.body.status, 'in_progress');
    assert.equal(started.body.version, 2);
    assert.ok(started.body.startedAt);
    assert.equal(started.body.completedAt, null);

    const startedRead = await request(app.getHttpServer())
      .get(`/v1/me/cleanings/${completed.cleaningId}`)
      .set(ownerAuth)
      .expect(200);
    assert.equal(startedRead.body.status, 'in_progress');
    assert.equal(startedRead.body.startedAt, started.body.startedAt);
    assert.equal(startedRead.body.version, 2);

    const done = await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${completed.cleaningId}/complete`)
      .set(ownerAuth)
      .expect(200);
    assert.equal(done.body.status, 'completed');
    assert.equal(done.body.version, 3);
    assert.ok(done.body.completedAt);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${completed.cleaningId}/complete`)
      .set(ownerAuth)
      .expect(409);

    const canonicalRead = await request(app.getHttpServer())
      .get(`/v1/me/cleanings/${completed.cleaningId}`)
      .set(ownerAuth)
      .expect(200);
    assert.equal(canonicalRead.body.status, 'completed');
    assert.equal(canonicalRead.body.startedAt, started.body.startedAt);
    assert.equal(canonicalRead.body.completedAt, done.body.completedAt);
    assert.equal(canonicalRead.body.version, 3);
    // Equal timestamps must still preserve per-Cleaning transition order.
    await pool.query(
      `UPDATE qleanfeel.cleaning_lifecycle_events
       SET occurred_at = '2026-10-01T00:00:00.000Z'
       WHERE cleaning_id = $1`,
      [completed.cleaningId],
    );
    const lifecycleRead = await request(app.getHttpServer())
      .get(`/v1/me/cleanings/${completed.cleaningId}/lifecycle`)
      .set(ownerAuth)
      .expect(200);
    assert.deepEqual(
      lifecycleRead.body.items.map(
        (event: {
          eventType: string;
          version: number;
          actorUserId: string;
        }) => [event.eventType, event.version, event.actorUserId],
      ),
      [
        ['started', 2, owner.userId],
        ['completed', 3, owner.userId],
      ],
    );
    assert.ok(
      Date.parse(lifecycleRead.body.items[0].occurredAt) <=
        Date.parse(lifecycleRead.body.items[1].occurredAt),
    );
    assert.equal(
      lifecycleRead.body.items[0].occurredAt,
      lifecycleRead.body.items[1].occurredAt,
    );
    await request(app.getHttpServer())
      .delete(`/v1/me/cleanings/${completed.cleaningId}/lifecycle`)
      .set(ownerAuth)
      .expect(404);

    const orderState = await pool.query<{
      order_status: string;
      calendar_status: string;
    }>(
      `SELECT o.status AS order_status, e.status AS calendar_status
       FROM qleanfeel.orders o
       JOIN qleanfeel.cleanings c ON c.order_id = o.id
       JOIN qleanfeel.calendar_entries e ON e.id = c.calendar_entry_id
       WHERE c.id = $1`,
      [completed.cleaningId],
    );
    assert.equal(orderState.rows[0]?.order_status, 'confirmed');
    assert.equal(orderState.rows[0]?.calendar_status, 'scheduled');

    const cancel = await createCleaning();
    const cancelled = await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cancel.cleaningId}/cancel`)
      .set(ownerAuth)
      .expect(200);
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal(cancelled.body.completedAt, null);

    const notPerformed = await createCleaning();
    const notPerformedResponse = await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${notPerformed.cleaningId}/not-performed`)
      .set(ownerAuth)
      .expect(200);
    assert.equal(notPerformedResponse.body.status, 'not_performed');
    assert.equal(notPerformedResponse.body.startedAt, null);
    assert.ok(notPerformedResponse.body.completedAt);

    const partial = await createCleaning();
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${partial.cleaningId}/start`)
      .set(ownerAuth)
      .expect(200);
    const partialResponse = await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${partial.cleaningId}/partially-complete`)
      .set(ownerAuth)
      .expect(200);
    assert.equal(partialResponse.body.status, 'partially_completed');
    assert.ok(partialResponse.body.startedAt);
    assert.ok(partialResponse.body.completedAt);

    const events = await pool.query<{
      event_type: string;
      version: number;
      actor_user_id: string;
    }>(
      `SELECT event_type, version, actor_user_id
       FROM qleanfeel.cleaning_lifecycle_events
       WHERE cleaning_id = $1 ORDER BY version`,
      [completed.cleaningId],
    );
    assert.deepEqual(
      events.rows.map(event => [event.event_type, event.version]),
      [
        ['started', 2],
        ['completed', 3],
      ],
    );
    assert.equal(events.rows[0]?.actor_user_id, owner.userId);

    const orderRead = await request(app.getHttpServer())
      .get(`/v1/me/orders/${completed.orderId}`)
      .set(ownerAuth)
      .expect(200);
    assert.equal(orderRead.body.cleanings[0]?.status, 'completed');
    assert.equal(
      orderRead.body.cleanings[0]?.completedAt,
      done.body.completedAt,
    );
  });
});

test('Cleaning scheduling and rescheduling preserve ownership, versions, and Calendar identity', async () => {
  await withOrderApplication(async ({ app, pool, bootstrap }) => {
    const owner = await bootstrap('cleaning-schedule-owner');
    const other = await bootstrap('cleaning-schedule-other');
    const suspended = await bootstrap('cleaning-schedule-suspended');
    const ownerAuth = { Authorization: `Bearer ${owner.accessToken}` };
    const otherAuth = { Authorization: `Bearer ${other.accessToken}` };
    await pool.query(
      "UPDATE qleanfeel.users SET status = 'suspended' WHERE id = $1",
      [suspended.userId],
    );
    const created = await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set(ownerAuth)
      .send(validRequest())
      .expect(201);
    const cleaningId = created.body.initialCleaning.id as string;
    const schedule = {
      startAt: '2026-10-12T10:00:00.000Z',
      endAt: '2026-10-12T11:00:00.000Z',
    };

    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/schedule`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/schedule`)
      .set({ Authorization: `Bearer ${suspended.accessToken}` })
      .send({
        schedule: {
          startAt: '2026-10-12T10:00:00.000Z',
          endAt: '2026-10-12T11:00:00.000Z',
        },
        expectedCleaningVersion: 1,
      })
      .expect(403);
    await request(app.getHttpServer())
      .post('/v1/me/cleanings/not-a-uuid/schedule')
      .set(ownerAuth)
      .send({ schedule, expectedCleaningVersion: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/schedule`)
      .set(ownerAuth)
      .send({ schedule, expectedCleaningVersion: 1, ownerId: owner.userId })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/schedule`)
      .set(ownerAuth)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/schedule`)
      .set(otherAuth)
      .send({ schedule, expectedCleaningVersion: 1 })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${randomUUID()}/schedule`)
      .set(ownerAuth)
      .send({ schedule, expectedCleaningVersion: 1 })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/schedule`)
      .set(ownerAuth)
      .send({
        schedule: { startAt: schedule.endAt, endAt: schedule.startAt },
        expectedCleaningVersion: 1,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/reschedule`)
      .set(ownerAuth)
      .send({
        schedule,
        expectedCleaningVersion: 1,
        expectedCalendarEntryVersion: 1,
      })
      .expect(409);

    const scheduled = await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/schedule`)
      .set(ownerAuth)
      .send({ schedule, expectedCleaningVersion: 1 })
      .expect(200);
    assert.equal(scheduled.body.status, 'planned');
    assert.equal(scheduled.body.version, 2);
    assert.ok(scheduled.body.calendarEntryId);
    assert.equal(scheduled.body.startedAt, null);
    assert.equal(scheduled.body.completedAt, null);
    assert.ok(scheduled.body.createdAt);
    assert.ok(scheduled.body.updatedAt);
    const calendarId = scheduled.body.calendarEntryId as string;

    const persisted = await pool.query<{
      cleaning_calendar_entry_id: string | null;
      cleaning_version: number;
      entry_owner_id: string;
      entry_status: string;
      entry_version: number;
      start_at: Date;
      end_at: Date;
    }>(
      `SELECT c.calendar_entry_id AS cleaning_calendar_entry_id,
              c.version AS cleaning_version,
              e.owner_user_id AS entry_owner_id, e.status AS entry_status,
              e.version AS entry_version, e.start_at, e.end_at
       FROM qleanfeel.cleanings c
       JOIN qleanfeel.calendar_entries e ON e.id = c.calendar_entry_id
       WHERE c.id = $1`,
      [cleaningId],
    );
    assert.equal(persisted.rows[0]?.cleaning_calendar_entry_id, calendarId);
    assert.equal(persisted.rows[0]?.cleaning_version, 2);
    assert.equal(persisted.rows[0]?.entry_owner_id, owner.userId);
    assert.equal(persisted.rows[0]?.entry_status, 'scheduled');
    assert.equal(persisted.rows[0]?.entry_version, 1);
    assert.equal(persisted.rows[0]?.start_at.toISOString(), schedule.startAt);
    assert.equal(persisted.rows[0]?.end_at.toISOString(), schedule.endAt);

    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/schedule`)
      .set(ownerAuth)
      .send({ schedule, expectedCleaningVersion: 2 })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/schedule`)
      .set(ownerAuth)
      .send({ schedule, expectedCleaningVersion: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/reschedule`)
      .set(otherAuth)
      .send({
        schedule,
        expectedCleaningVersion: 2,
        expectedCalendarEntryVersion: 1,
      })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${randomUUID()}/reschedule`)
      .set(ownerAuth)
      .send({
        schedule,
        expectedCleaningVersion: 1,
        expectedCalendarEntryVersion: 1,
      })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/reschedule`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/v1/me/cleanings/not-a-uuid/reschedule')
      .set(ownerAuth)
      .send({
        schedule,
        expectedCleaningVersion: 1,
        expectedCalendarEntryVersion: 1,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/reschedule`)
      .set({ Authorization: `Bearer ${suspended.accessToken}` })
      .send({
        schedule,
        expectedCleaningVersion: 1,
        expectedCalendarEntryVersion: 1,
      })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/reschedule`)
      .set(ownerAuth)
      .send({
        schedule: { startAt: schedule.endAt, endAt: schedule.startAt },
        expectedCleaningVersion: 1,
        expectedCalendarEntryVersion: 1,
      })
      .expect(400);
    const nextSchedule = {
      startAt: '2026-10-13T12:00:00.000Z',
      endAt: '2026-10-13T13:00:00.000Z',
    };
    const rescheduled = await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/reschedule`)
      .set(ownerAuth)
      .send({
        schedule: nextSchedule,
        expectedCleaningVersion: 2,
        expectedCalendarEntryVersion: 1,
      })
      .expect(200);
    assert.equal(rescheduled.body.calendarEntryId, calendarId);
    assert.equal(rescheduled.body.version, 2);
    assert.equal(rescheduled.body.status, 'planned');
    assert.equal(rescheduled.body.startedAt, null);
    assert.equal(rescheduled.body.completedAt, null);

    const afterReschedule = await pool.query<{
      calendar_entry_id: string;
      cleaning_version: number;
      entry_version: number;
      start_at: Date;
      end_at: Date;
    }>(
      `SELECT c.calendar_entry_id, c.version AS cleaning_version,
              e.version AS entry_version, e.start_at, e.end_at
       FROM qleanfeel.cleanings c
       JOIN qleanfeel.calendar_entries e ON e.id = c.calendar_entry_id
       WHERE c.id = $1`,
      [cleaningId],
    );
    assert.equal(afterReschedule.rows[0]?.calendar_entry_id, calendarId);
    assert.equal(afterReschedule.rows[0]?.cleaning_version, 2);
    assert.equal(afterReschedule.rows[0]?.entry_version, 2);
    assert.equal(
      afterReschedule.rows[0]?.start_at.toISOString(),
      nextSchedule.startAt,
    );
    assert.equal(
      afterReschedule.rows[0]?.end_at.toISOString(),
      nextSchedule.endAt,
    );

    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/reschedule`)
      .set(ownerAuth)
      .send({
        schedule,
        expectedCleaningVersion: 1,
        expectedCalendarEntryVersion: 2,
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/reschedule`)
      .set(ownerAuth)
      .send({
        schedule,
        expectedCleaningVersion: 2,
        expectedCalendarEntryVersion: 1,
      })
      .expect(409);

    const lifecycle = await request(app.getHttpServer())
      .get(`/v1/me/cleanings/${cleaningId}/lifecycle`)
      .set(ownerAuth)
      .expect(200);
    assert.deepEqual(lifecycle.body, { items: [] });

    const racedSchedule = {
      startAt: '2026-10-14T14:00:00.000Z',
      endAt: '2026-10-14T15:00:00.000Z',
    };
    const race = await Promise.all([
      request(app.getHttpServer())
        .post(`/v1/me/cleanings/${cleaningId}/reschedule`)
        .set(ownerAuth)
        .send({
          schedule: racedSchedule,
          expectedCleaningVersion: 2,
          expectedCalendarEntryVersion: 2,
        }),
      request(app.getHttpServer())
        .post(`/v1/me/cleanings/${cleaningId}/reschedule`)
        .set(ownerAuth)
        .send({
          schedule: {
            startAt: '2026-10-15T14:00:00.000Z',
            endAt: '2026-10-15T15:00:00.000Z',
          },
          expectedCleaningVersion: 2,
          expectedCalendarEntryVersion: 2,
        }),
    ]);
    assert.deepEqual(race.map(response => response.status).sort(), [200, 409]);
    const finalVersions = await pool.query<{
      cleaning_version: number;
      entry_version: number;
    }>(
      `SELECT c.version AS cleaning_version, e.version AS entry_version
       FROM qleanfeel.cleanings c
       JOIN qleanfeel.calendar_entries e ON e.id = c.calendar_entry_id
       WHERE c.id = $1`,
      [cleaningId],
    );
    assert.equal(finalVersions.rows[0]?.cleaning_version, 2);
    assert.equal(finalVersions.rows[0]?.entry_version, 3);

    const started = await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/start`)
      .set(ownerAuth)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${cleaningId}/reschedule`)
      .set(ownerAuth)
      .send({
        schedule,
        expectedCleaningVersion: started.body.version,
        expectedCalendarEntryVersion: 3,
      })
      .expect(409);

    const terminalOrder = await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set(ownerAuth)
      .send({
        ...validRequest(),
        schedule: {
          startAt: '2026-10-21T10:00:00.000Z',
          endAt: '2026-10-21T11:00:00.000Z',
        },
      })
      .expect(201);
    const terminalCleaningId = terminalOrder.body.initialCleaning.id as string;
    const terminalCalendarId = terminalOrder.body.calendarEntry.id as string;
    await pool.query(
      "UPDATE qleanfeel.calendar_entries SET status = 'completed' WHERE id = $1",
      [terminalCalendarId],
    );
    await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${terminalCleaningId}/reschedule`)
      .set(ownerAuth)
      .send({
        schedule,
        expectedCleaningVersion: 1,
        expectedCalendarEntryVersion: 1,
      })
      .expect(409);
  });
});

test('Cleaning scheduling and execution serialize against each other in PostgreSQL', async () => {
  await withOrderApplication(async ({ app, pool, bootstrap }) => {
    const owner = await bootstrap('cleaning-scheduling-race-owner');
    const authorization = { Authorization: `Bearer ${owner.accessToken}` };
    const createOrder = async (schedule?: {
      startAt: string;
      endAt: string;
    }) => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/orders')
        .set(authorization)
        .send({ ...validRequest(), ...(schedule ? { schedule } : {}) })
        .expect(201);
      return response.body.initialCleaning as {
        id: string;
        calendarEntryId: string | null;
        version: number;
      };
    };

    const unscheduled = await createOrder();
    const firstRace = await Promise.all([
      request(app.getHttpServer())
        .post(`/v1/me/cleanings/${unscheduled.id}/schedule`)
        .set(authorization)
        .send({
          schedule: {
            startAt: '2026-10-18T10:00:00.000Z',
            endAt: '2026-10-18T11:00:00.000Z',
          },
          expectedCleaningVersion: 1,
        }),
      request(app.getHttpServer())
        .post(`/v1/me/cleanings/${unscheduled.id}/start`)
        .set(authorization),
    ]);
    assert.ok(
      firstRace.every(response => [200, 409].includes(response.status)),
    );
    assert.ok(firstRace.some(response => response.status === 200));
    const firstState = await pool.query<{
      status: string;
      calendar_entry_id: string | null;
      version: number;
      started_at: Date | null;
      event_count: string;
    }>(
      `SELECT c.status, c.calendar_entry_id, c.version, c.started_at,
              (SELECT count(*)::text FROM qleanfeel.cleaning_lifecycle_events e
               WHERE e.cleaning_id = c.id) AS event_count
       FROM qleanfeel.cleanings c WHERE c.id = $1`,
      [unscheduled.id],
    );
    const initialResult = firstState.rows[0];
    assert.ok(initialResult);
    if (initialResult.status === 'in_progress') {
      assert.ok(initialResult.started_at);
      assert.ok([2, 3].includes(initialResult.version));
      assert.equal(initialResult.event_count, '1');
    } else {
      assert.equal(initialResult.status, 'planned');
      assert.ok(initialResult.calendar_entry_id);
      assert.equal(initialResult.version, 2);
      assert.equal(initialResult.event_count, '0');
    }

    const scheduled = await createOrder({
      startAt: '2026-10-19T10:00:00.000Z',
      endAt: '2026-10-19T11:00:00.000Z',
    });
    assert.ok(scheduled.calendarEntryId);
    const secondRace = await Promise.all([
      request(app.getHttpServer())
        .post(`/v1/me/cleanings/${scheduled.id}/reschedule`)
        .set(authorization)
        .send({
          schedule: {
            startAt: '2026-10-20T10:00:00.000Z',
            endAt: '2026-10-20T11:00:00.000Z',
          },
          expectedCleaningVersion: scheduled.version,
          expectedCalendarEntryVersion: 1,
        }),
      request(app.getHttpServer())
        .post(`/v1/me/cleanings/${scheduled.id}/start`)
        .set(authorization),
    ]);
    assert.ok(
      secondRace.every(response => [200, 409].includes(response.status)),
    );
    assert.ok(secondRace.some(response => response.status === 200));
    const secondState = await pool.query<{
      status: string;
      calendar_entry_id: string | null;
      cleaning_version: number;
      entry_version: number;
      entry_status: string;
      event_count: string;
    }>(
      `SELECT c.status, c.calendar_entry_id,
              c.version AS cleaning_version, e.version AS entry_version,
              e.status AS entry_status,
              (SELECT count(*)::text FROM qleanfeel.cleaning_lifecycle_events ev
               WHERE ev.cleaning_id = c.id) AS event_count
       FROM qleanfeel.cleanings c
       JOIN qleanfeel.calendar_entries e ON e.id = c.calendar_entry_id
       WHERE c.id = $1`,
      [scheduled.id],
    );
    const finalState = secondState.rows[0];
    assert.ok(finalState);
    assert.equal(finalState.calendar_entry_id, scheduled.calendarEntryId);
    assert.equal(finalState.entry_status, 'scheduled');
    assert.ok([1, 2].includes(finalState.entry_version));
    if (finalState.status === 'in_progress') {
      assert.equal(finalState.cleaning_version, 2);
      assert.equal(finalState.event_count, '1');
    } else {
      assert.equal(finalState.status, 'planned');
      assert.equal(finalState.cleaning_version, scheduled.version);
      assert.equal(finalState.entry_version, 2);
      assert.equal(finalState.event_count, '0');
    }
  });
});

test('Cleaning schedule and reschedule writes roll back atomically on persistence failure', async () => {
  await withOrderApplication(async ({ app, pool, bootstrap }) => {
    const owner = await bootstrap('cleaning-schedule-rollback');
    const authorization = { Authorization: `Bearer ${owner.accessToken}` };
    const createCleaning = async () => {
      const created = await request(app.getHttpServer())
        .post('/v1/me/orders')
        .set(authorization)
        .send(validRequest())
        .expect(201);
      return created.body.initialCleaning.id as string;
    };
    const schedule = {
      startAt: '2026-10-16T10:00:00.000Z',
      endAt: '2026-10-16T11:00:00.000Z',
    };

    await pool.query(`CREATE OR REPLACE FUNCTION qleanfeel.reject_test_cleaning_schedule()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'forced cleaning schedule failure';
      END $$`);
    await pool.query(`CREATE TRIGGER reject_test_cleaning_schedule
      BEFORE UPDATE ON qleanfeel.cleanings
      FOR EACH ROW EXECUTE FUNCTION qleanfeel.reject_test_cleaning_schedule()`);
    const unscheduledId = await createCleaning();
    try {
      await request(app.getHttpServer())
        .post(`/v1/me/cleanings/${unscheduledId}/schedule`)
        .set(authorization)
        .send({ schedule, expectedCleaningVersion: 1 })
        .expect(500);
    } finally {
      await pool.query(
        'DROP TRIGGER IF EXISTS reject_test_cleaning_schedule ON qleanfeel.cleanings',
      );
      await pool.query(
        'DROP FUNCTION IF EXISTS qleanfeel.reject_test_cleaning_schedule()',
      );
    }
    const scheduleRollback = await pool.query<{
      calendar_entry_id: string | null;
      version: number;
      entry_count: string;
    }>(
      `SELECT c.calendar_entry_id, c.version,
              (SELECT count(*)::text FROM qleanfeel.calendar_entries e
               WHERE e.owner_user_id = $2 AND e.start_at = $3) AS entry_count
       FROM qleanfeel.cleanings c WHERE c.id = $1`,
      [unscheduledId, owner.userId, schedule.startAt],
    );
    assert.equal(scheduleRollback.rows[0]?.calendar_entry_id, null);
    assert.equal(scheduleRollback.rows[0]?.version, 1);
    assert.equal(scheduleRollback.rows[0]?.entry_count, '0');

    const rescheduleId = await createCleaning();
    const scheduled = await request(app.getHttpServer())
      .post(`/v1/me/cleanings/${rescheduleId}/schedule`)
      .set(authorization)
      .send({ schedule, expectedCleaningVersion: 1 })
      .expect(200);
    const entryId = scheduled.body.calendarEntryId as string;
    await pool.query(`CREATE OR REPLACE FUNCTION qleanfeel.reject_test_calendar_reschedule()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'forced calendar reschedule failure';
      END $$`);
    await pool.query(`CREATE TRIGGER reject_test_calendar_reschedule
      BEFORE UPDATE ON qleanfeel.calendar_entries
      FOR EACH ROW EXECUTE FUNCTION qleanfeel.reject_test_calendar_reschedule()`);
    try {
      await request(app.getHttpServer())
        .post(`/v1/me/cleanings/${rescheduleId}/reschedule`)
        .set(authorization)
        .send({
          schedule: {
            startAt: '2026-10-17T10:00:00.000Z',
            endAt: '2026-10-17T11:00:00.000Z',
          },
          expectedCleaningVersion: 2,
          expectedCalendarEntryVersion: 1,
        })
        .expect(500);
    } finally {
      await pool.query(
        'DROP TRIGGER IF EXISTS reject_test_calendar_reschedule ON qleanfeel.calendar_entries',
      );
      await pool.query(
        'DROP FUNCTION IF EXISTS qleanfeel.reject_test_calendar_reschedule()',
      );
    }
    const rescheduleRollback = await pool.query<{
      calendar_entry_id: string;
      cleaning_version: number;
      entry_version: number;
      start_at: Date;
    }>(
      `SELECT c.calendar_entry_id, c.version AS cleaning_version,
              e.version AS entry_version, e.start_at
       FROM qleanfeel.cleanings c
       JOIN qleanfeel.calendar_entries e ON e.id = c.calendar_entry_id
       WHERE c.id = $1`,
      [rescheduleId],
    );
    assert.equal(rescheduleRollback.rows[0]?.calendar_entry_id, entryId);
    assert.equal(rescheduleRollback.rows[0]?.cleaning_version, 2);
    assert.equal(rescheduleRollback.rows[0]?.entry_version, 1);
    assert.equal(
      rescheduleRollback.rows[0]?.start_at.toISOString(),
      schedule.startAt,
    );
  });
});

test('Cleaning lifecycle update and event roll back together when event append fails', async () => {
  await withOrderApplication(async ({ app, pool, bootstrap }) => {
    const owner = await bootstrap('cleaning-lifecycle-rollback');
    const created = await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set({ Authorization: `Bearer ${owner.accessToken}` })
      .send(validRequest())
      .expect(201);
    const cleaningId = created.body.initialCleaning.id as string;
    await pool.query(
      'DROP TRIGGER IF EXISTS reject_test_cleaning_lifecycle_event ON qleanfeel.cleaning_lifecycle_events',
    );
    await pool.query(
      'DROP FUNCTION IF EXISTS qleanfeel.reject_test_cleaning_lifecycle_event()',
    );
    await pool.query(`
      CREATE OR REPLACE FUNCTION qleanfeel.reject_test_cleaning_lifecycle_event()
      RETURNS trigger LANGUAGE plpgsql AS $body$
      BEGIN
        IF NEW.actor_user_id = '${owner.userId}'::uuid THEN
          RAISE EXCEPTION 'forced Cleaning lifecycle event failure';
        END IF;
        RETURN NEW;
      END
      $body$`);
    await pool.query(`
      CREATE TRIGGER reject_test_cleaning_lifecycle_event
      BEFORE INSERT ON qleanfeel.cleaning_lifecycle_events
      FOR EACH ROW EXECUTE FUNCTION qleanfeel.reject_test_cleaning_lifecycle_event()`);
    try {
      await request(app.getHttpServer())
        .post(`/v1/me/cleanings/${cleaningId}/start`)
        .set({ Authorization: `Bearer ${owner.accessToken}` })
        .expect(500);
    } finally {
      await pool.query(
        'DROP TRIGGER IF EXISTS reject_test_cleaning_lifecycle_event ON qleanfeel.cleaning_lifecycle_events',
      );
      await pool.query(
        'DROP FUNCTION IF EXISTS qleanfeel.reject_test_cleaning_lifecycle_event()',
      );
    }

    const state = await pool.query<{
      status: string;
      version: number;
      started_at: Date | null;
      event_count: string;
    }>(
      `SELECT c.status, c.version, c.started_at,
         (SELECT count(*)::text FROM qleanfeel.cleaning_lifecycle_events e
          WHERE e.cleaning_id = c.id) AS event_count
       FROM qleanfeel.cleanings c WHERE c.id = $1`,
      [cleaningId],
    );
    assert.deepEqual(state.rows[0], {
      status: 'planned',
      version: 1,
      started_at: null,
      event_count: '0',
    });
  });
});

test('concurrent Cleaning starts allow one versioned transition and one conflict', async () => {
  await withOrderApplication(async ({ app, pool, bootstrap }) => {
    const owner = await bootstrap('cleaning-lifecycle-concurrent');
    const created = await request(app.getHttpServer())
      .post('/v1/me/orders')
      .set({ Authorization: `Bearer ${owner.accessToken}` })
      .send(validRequest())
      .expect(201);
    const cleaningId = created.body.initialCleaning.id as string;
    const authorization = { Authorization: `Bearer ${owner.accessToken}` };
    const start = () =>
      request(app.getHttpServer())
        .post(`/v1/me/cleanings/${cleaningId}/start`)
        .set(authorization);
    const results = await Promise.all([start(), start()]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    const persisted = await pool.query<{
      status: string;
      version: number;
      event_count: string;
    }>(
      `SELECT c.status, c.version,
         (SELECT count(*)::text FROM qleanfeel.cleaning_lifecycle_events e
          WHERE e.cleaning_id = c.id) AS event_count
       FROM qleanfeel.cleanings c WHERE c.id = $1`,
      [cleaningId],
    );
    assert.deepEqual(persisted.rows[0], {
      status: 'in_progress',
      version: 2,
      event_count: '1',
    });
  });
});
