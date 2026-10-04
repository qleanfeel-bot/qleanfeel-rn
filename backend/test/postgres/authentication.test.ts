import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { IdentityProofVerifier } from '../../src/application/identity/ports/identity-proof-verifier.js';
import { InvalidIdentityProofError } from '../../src/application/identity/identity-errors.js';
import { configureApi } from '../../src/http/configure-api.js';
import { POSTGRES_POOL } from '../../src/infrastructure/persistence/database.tokens.js';
import { UuidV7Generator } from '../../src/infrastructure/identity/uuid-v7-generator.js';
import { BACKEND_CONFIG } from '../../src/shared/config/backend-config.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'Set TEST_DATABASE_URL to a dedicated PostgreSQL 18 test database before running test:postgres.',
  );
}

process.env.APP_ENV ??= 'test';
process.env.DATABASE_URL ??= testDatabaseUrl;

const signingSecret =
  process.env.ACCESS_TOKEN_SIGNING_SECRET ??
  'postgres-test-only-signing-secret-with-at-least-32-bytes';
const identifiers = new UuidV7Generator();

interface AuthTestContext {
  readonly app: Awaited<ReturnType<typeof createAuthApplication>>['app'];
  readonly pool: Pool;
  readonly subject: (prefix: string) => string;
  readonly close: () => Promise<void>;
}

async function createAuthApplication() {
  const pool = new Pool({ connectionString: testDatabaseUrl, max: 5 });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(BACKEND_CONFIG)
    .useValue({
      environment: 'test',
      port: 3000,
      databaseUrl: testDatabaseUrl,
      databasePoolMax: 5,
      firebaseProjectId: 'integration-test-project',
      accessTokenSigningSecret: signingSecret,
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
    subject(prefix: string) {
      const value = `${prefix}-${randomBytes(12).toString('hex')}`;
      subjects.add(value);
      return value;
    },
    async close() {
      for (const subject of subjects) {
        await deleteIdentitySubject(pool, subject);
      }
      await app.close();
    },
  };
}

async function withAuthApplication(
  operation: (context: AuthTestContext) => Promise<void>,
): Promise<void> {
  const context = await createAuthApplication();
  try {
    await operation(context);
  } finally {
    await context.close();
  }
}

async function deleteIdentitySubject(pool: Pool, subject: string) {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT user_id AS id FROM qleanfeel.auth_identities
     WHERE provider = 'firebase' AND provider_subject = $1`,
    [subject],
  );
  const userIds = rows.map(row => row.id);
  if (userIds.length === 0) return;

  await pool.query(
    `UPDATE qleanfeel.session_refresh_tokens
     SET replaced_by_id = NULL
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

function bootstrap(app: AuthTestContext['app'], subject: string) {
  return request(app.getHttpServer())
    .post('/v1/auth/bootstrap')
    .send({ firebaseIdToken: `proof:${subject}` });
}

test('auth migration creates only the four tables in qleanfeel and enforces relational constraints', async () => {
  await withAuthApplication(async ({ app, pool, subject }) => {
    const value = subject('constraints');
    const created = await bootstrap(app, value);
    assert.equal(created.status, 200);

    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'qleanfeel'
         AND table_type = 'BASE TABLE'`,
    );
    assert.deepEqual(tables.rows.map(row => row.table_name).sort(), [
      'auth_identities',
      'auth_sessions',
      'session_refresh_tokens',
      'users',
    ]);

    const identity = await pool.query<{
      id: string;
      user_id: string;
    }>(
      `SELECT id, user_id FROM qleanfeel.auth_identities
       WHERE provider = 'firebase' AND provider_subject = $1`,
      [value],
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO qleanfeel.auth_identities
         (id, user_id, provider, provider_subject, created_at, last_authenticated_at)
         VALUES ($1, $2, 'firebase', $3, now(), now())`,
        [identifiers.next(), identity.rows[0]?.user_id, value],
      ),
      { code: '23505' },
    );

    const token = await pool.query<{
      session_id: string;
      token_hash: string;
    }>(
      `SELECT session_id, token_hash FROM qleanfeel.session_refresh_tokens
       WHERE session_id IN (SELECT id FROM qleanfeel.auth_sessions WHERE user_id = $1)
       LIMIT 1`,
      [identity.rows[0]?.user_id],
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO qleanfeel.session_refresh_tokens
         (id, session_id, token_hash, created_at, expires_at)
         VALUES ($1, $2, $3, now(), now() + interval '1 day')`,
        [
          identifiers.next(),
          token.rows[0]?.session_id,
          token.rows[0]?.token_hash,
        ],
      ),
      { code: '23505' },
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO qleanfeel.auth_sessions (id, user_id, status, created_at, expires_at)
         VALUES ($1, $2, 'active', now(), now() + interval '1 day')`,
        [identifiers.next(), identifiers.next()],
      ),
      { code: '23503' },
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO qleanfeel.auth_identities
         (id, user_id, provider, provider_subject, created_at, last_authenticated_at)
         VALUES ($1, $2, 'firebase', $3, now(), now())`,
        [identifiers.next(), identifiers.next(), subject('missing-user')],
      ),
      { code: '23503' },
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO qleanfeel.session_refresh_tokens
         (id, session_id, token_hash, created_at, expires_at)
         VALUES ($1, $2, $3, now(), now() + interval '1 day')`,
        [
          identifiers.next(),
          identifiers.next(),
          randomBytes(32).toString('hex'),
        ],
      ),
      { code: '23503' },
    );
  });
});

test('bootstrap creates one Qleanfeel User, links Firebase identity, and gives each login a separate session', async () => {
  await withAuthApplication(async ({ app, pool, subject }) => {
    const providerSubject = subject('bootstrap');
    const first = await bootstrap(app, providerSubject).expect(200);
    const second = await bootstrap(app, providerSubject).expect(200);

    assert.notEqual(first.body.user.id, providerSubject);
    assert.equal(first.body.user.id, second.body.user.id);
    assert.notEqual(first.body.session.id, second.body.session.id);
    assert.notEqual(first.body.refreshToken, second.body.refreshToken);
    assert.equal(first.body.tokenType, 'Bearer');

    const counts = await pool.query<{
      users: string;
      identities: string;
      sessions: string;
    }>(
      `SELECT
         (SELECT count(*) FROM qleanfeel.users WHERE id = $1) AS users,
         (SELECT count(*) FROM qleanfeel.auth_identities WHERE provider_subject = $2) AS identities,
         (SELECT count(*) FROM qleanfeel.auth_sessions WHERE user_id = $1) AS sessions`,
      [first.body.user.id, providerSubject],
    );
    assert.deepEqual(counts.rows[0], {
      users: '1',
      identities: '1',
      sessions: '2',
    });

    const persisted = await pool.query<{ token_hash: string }>(
      `SELECT token_hash FROM qleanfeel.session_refresh_tokens
       WHERE session_id = $1`,
      [first.body.session.id],
    );
    assert.equal(persisted.rows.length, 1);
    assert.equal(
      persisted.rows[0]?.token_hash,
      createHash('sha256').update(first.body.refreshToken).digest('hex'),
    );
    assert.notEqual(persisted.rows[0]?.token_hash, first.body.refreshToken);
  });
});

test('invalid Firebase proof returns 401 without writing identity state', async () => {
  await withAuthApplication(async ({ app, pool }) => {
    const before = await pool.query<{ count: string }>(
      'SELECT count(*) FROM qleanfeel.users',
    );
    const response = await request(app.getHttpServer())
      .post('/v1/auth/bootstrap')
      .send({ firebaseIdToken: 'invalid-proof' })
      .expect(401);
    const after = await pool.query<{ count: string }>(
      'SELECT count(*) FROM qleanfeel.users',
    );

    assert.equal(response.body.message, 'Identity proof is invalid.');
    assert.equal(after.rows[0]?.count, before.rows[0]?.count);
    assert.doesNotMatch(
      JSON.stringify(response.body),
      /Firebase|invalid-id-token/,
    );
  });
});

test('concurrent bootstrap for one provider subject creates one User and two sessions', async () => {
  await withAuthApplication(async ({ app, pool, subject }) => {
    const providerSubject = subject('concurrent');
    const [first, second] = await Promise.all([
      bootstrap(app, providerSubject),
      bootstrap(app, providerSubject),
    ]);

    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(first.body.user.id, second.body.user.id);
    assert.notEqual(first.body.session.id, second.body.session.id);
    const counts = await pool.query<{ count: string }>(
      `SELECT count(*) FROM qleanfeel.users u
       JOIN qleanfeel.auth_identities i ON i.user_id = u.id
       WHERE i.provider = 'firebase' AND i.provider_subject = $1`,
      [providerSubject],
    );
    assert.equal(counts.rows[0]?.count, '1');
  });
});

test('bootstrap transaction rolls back all identity and session state when refresh persistence fails', async () => {
  await withAuthApplication(async ({ app, pool, subject }) => {
    const providerSubject = subject('rollback-final');
    await pool.query(`
      CREATE OR REPLACE FUNCTION fail_test_refresh_insert() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM qleanfeel.auth_sessions s
          JOIN qleanfeel.auth_identities i ON i.user_id = s.user_id
          WHERE s.id = NEW.session_id
            AND i.provider_subject LIKE 'rollback-final-%'
        ) THEN
          RAISE EXCEPTION 'forced integration-test failure';
        END IF;
        RETURN NEW;
      END;
      $$;
    `);
    await pool.query(`
      CREATE TRIGGER fail_test_refresh_insert
      BEFORE INSERT ON qleanfeel.session_refresh_tokens
      FOR EACH ROW EXECUTE FUNCTION fail_test_refresh_insert();
    `);

    try {
      await bootstrap(app, providerSubject).expect(500);
      const result = await pool.query<{
        users: string;
        identities: string;
        sessions: string;
        refreshTokens: string;
      }>(
        `SELECT
          (SELECT count(*) FROM qleanfeel.users u
           JOIN qleanfeel.auth_identities i ON i.user_id = u.id
           WHERE i.provider_subject = $1) AS users,
          (SELECT count(*) FROM qleanfeel.auth_identities
           WHERE provider_subject = $1) AS identities,
          (SELECT count(*) FROM qleanfeel.auth_sessions s
           JOIN qleanfeel.auth_identities i ON i.user_id = s.user_id
           WHERE i.provider_subject = $1) AS sessions,
          (SELECT count(*) FROM qleanfeel.session_refresh_tokens t
           JOIN qleanfeel.auth_sessions s ON s.id = t.session_id
           JOIN qleanfeel.auth_identities i ON i.user_id = s.user_id
           WHERE i.provider_subject = $1) AS "refreshTokens"`,
        [providerSubject],
      );
      assert.deepEqual(result.rows[0], {
        users: '0',
        identities: '0',
        sessions: '0',
        refreshTokens: '0',
      });
    } finally {
      await pool.query(
        'DROP TRIGGER IF EXISTS fail_test_refresh_insert ON qleanfeel.session_refresh_tokens',
      );
      await pool.query('DROP FUNCTION IF EXISTS fail_test_refresh_insert()');
    }
  });
});

test('suspended accounts cannot bootstrap, refresh, or call /me', async () => {
  await withAuthApplication(async ({ app, pool, subject }) => {
    const providerSubject = subject('suspended');
    const initial = await bootstrap(app, providerSubject).expect(200);
    await pool.query(
      "UPDATE qleanfeel.users SET status = 'suspended' WHERE id = $1",
      [initial.body.user.id],
    );

    await bootstrap(app, providerSubject).expect(403);
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${initial.body.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: initial.body.refreshToken })
      .expect(403);
  });
});

test('refresh atomically rotates the stored hash and rejects reuse of the old credential', async () => {
  await withAuthApplication(async ({ app, pool, subject }) => {
    const providerSubject = subject('refresh');
    const initial = await bootstrap(app, providerSubject).expect(200);
    const rotated = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: initial.body.refreshToken })
      .expect(200);

    assert.equal(rotated.body.user.id, initial.body.user.id);
    assert.equal(rotated.body.session.id, initial.body.session.id);
    assert.notEqual(rotated.body.refreshToken, initial.body.refreshToken);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: initial.body.refreshToken })
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${rotated.body.accessToken}`)
      .expect(200);

    const tokenRows = await pool.query<{
      id: string;
      consumed_at: Date | null;
      replaced_by_id: string | null;
      token_hash: string;
    }>(
      `SELECT id, consumed_at, replaced_by_id, token_hash
       FROM qleanfeel.session_refresh_tokens WHERE session_id = $1`,
      [initial.body.session.id],
    );
    assert.equal(tokenRows.rows.length, 2);
    const oldHash = createHash('sha256')
      .update(initial.body.refreshToken)
      .digest('hex');
    const newHash = createHash('sha256')
      .update(rotated.body.refreshToken)
      .digest('hex');
    const oldRow = tokenRows.rows.find(row => row.token_hash === oldHash);
    const newRow = tokenRows.rows.find(row => row.token_hash === newHash);
    assert.ok(oldRow?.consumed_at);
    assert.equal(oldRow?.replaced_by_id, newRow?.id);
    assert.equal(newRow?.consumed_at, null);
    assert.equal(newRow?.token_hash, newHash);
    assert.notEqual(oldRow?.token_hash, initial.body.refreshToken);
  });
});

test('concurrent refresh requests cannot both consume the same credential', async () => {
  await withAuthApplication(async ({ app, pool, subject }) => {
    const initial = await bootstrap(app, subject('refresh-race')).expect(200);
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: initial.body.refreshToken }),
      request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: initial.body.refreshToken }),
    ]);

    assert.deepEqual(
      [first.status, second.status].sort((left, right) => left - right),
      [200, 401],
    );
    const successful = first.status === 200 ? first : second;
    assert.equal(successful.body.session.id, initial.body.session.id);
    assert.notEqual(successful.body.refreshToken, initial.body.refreshToken);

    const tokens = await pool.query<{
      token_hash: string;
      consumed_at: Date | null;
    }>(
      `SELECT token_hash, consumed_at FROM qleanfeel.session_refresh_tokens
       WHERE session_id = $1`,
      [initial.body.session.id],
    );
    const initialHash = createHash('sha256')
      .update(initial.body.refreshToken)
      .digest('hex');
    const consumedInitial = tokens.rows.find(
      row => row.token_hash === initialHash,
    );
    assert.equal(tokens.rows.length, 2);
    assert.ok(consumedInitial?.consumed_at);
  });
});

test('refresh rejects invalid, mismatched, expired, and revoked credentials', async () => {
  await withAuthApplication(async ({ app, pool, subject }) => {
    const providerSubject = subject('refresh-invalid');
    const initial = await bootstrap(app, providerSubject).expect(200);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: 'not-a-refresh-token' })
      .expect(401);

    const mismatch = `${identifiers.next()}.${randomBytes(32).toString('base64url')}`;
    await pool.query(
      `INSERT INTO qleanfeel.session_refresh_tokens
       (id, session_id, token_hash, created_at, expires_at)
       VALUES ($1, $2, $3, now(), $4)`,
      [
        identifiers.next(),
        initial.body.session.id,
        createHash('sha256').update(mismatch).digest('hex'),
        initial.body.session.expiresAt,
      ],
    );
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: mismatch })
      .expect(401);

    const expired = await bootstrap(app, subject('expired')).expect(200);
    const expiredHash = createHash('sha256')
      .update(expired.body.refreshToken)
      .digest('hex');
    await pool.query(
      `UPDATE qleanfeel.session_refresh_tokens SET expires_at = now() - interval '1 second'
       WHERE token_hash = $1`,
      [expiredHash],
    );
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: expired.body.refreshToken })
      .expect(401);

    const revoked = await bootstrap(app, subject('revoked')).expect(200);
    await pool.query(
      "UPDATE qleanfeel.auth_sessions SET status = 'revoked', revoked_at = now() WHERE id = $1",
      [revoked.body.session.id],
    );
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: revoked.body.refreshToken })
      .expect(401);
  });
});

test('logout revokes only the current session and invalidates access and refresh credentials', async () => {
  await withAuthApplication(async ({ app, pool, subject }) => {
    const providerSubject = subject('logout');
    const first = await bootstrap(app, providerSubject).expect(200);
    const second = await bootstrap(app, providerSubject).expect(200);

    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(204);
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: first.body.refreshToken })
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .expect(200);

    const tokens = await pool.query<{ revoked_at: Date | null }>(
      'SELECT revoked_at FROM qleanfeel.session_refresh_tokens WHERE session_id = $1',
      [first.body.session.id],
    );
    assert.ok(tokens.rows[0]?.revoked_at);
  });
});

test('/me resolves the Qleanfeel User and invalid/revoked access credentials return 401', async () => {
  await withAuthApplication(async ({ app, subject }) => {
    const providerSubject = subject('me');
    const created = await bootstrap(app, providerSubject).expect(200);
    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${created.body.accessToken}`)
      .expect(200);

    assert.deepEqual(me.body, {
      id: created.body.user.id,
      status: 'active',
      createdAt: created.body.user.createdAt,
      updatedAt: created.body.user.createdAt,
    });
    assert.notEqual(me.body.id, providerSubject);
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', 'Bearer malformed-token')
      .expect(401);
    await request(app.getHttpServer()).get('/v1/me').expect(401);
  });
});
