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
