import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { Test } from '@nestjs/testing';
import { TerminusModule } from '@nestjs/terminus';
import { PostgresHealthIndicator } from '../../src/infrastructure/persistence/postgres-health-indicator.js';
import { POSTGRES_POOL } from '../../src/infrastructure/persistence/database.tokens.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'Set TEST_DATABASE_URL to a dedicated PostgreSQL 18 test database before running test:postgres.',
  );
}

test('PostgreSQL readiness query reaches the configured database', async () => {
  const pool = new Pool({ connectionString: testDatabaseUrl, max: 1 });
  const moduleRef = await Test.createTestingModule({
    imports: [TerminusModule.forRoot({ logger: false })],
    providers: [
      PostgresHealthIndicator,
      { provide: POSTGRES_POOL, useValue: pool },
    ],
  }).compile();

  try {
    const [{ server_version_num: version }] = await pool
      .query('SHOW server_version_num')
      .then(result => result.rows);

    assert.equal(Number.parseInt(version, 10) >= 180000, true);
    const readiness = await moduleRef.get(PostgresHealthIndicator).isHealthy();
    assert.equal(readiness.postgresql.status, 'up');
  } finally {
    await moduleRef.close();
    await pool.end();
  }
});
