import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import { UnitOfWork } from '../src/application/ports/unit-of-work.js';
import {
  DRIZZLE_DATABASE,
  POSTGRES_POOL,
} from '../src/infrastructure/persistence/database.tokens.js';
import { DatabaseModule } from '../src/infrastructure/persistence/database.module.js';
import { PostgresUnitOfWork } from '../src/infrastructure/persistence/postgres-unit-of-work.js';
import { BACKEND_CONFIG } from '../src/shared/config/backend-config.js';

test('composes pg, Drizzle, and the framework-free UnitOfWork port', async () => {
  const pool = {
    query: async () => ({ rows: [] }),
    end: async () => undefined,
  };

  const moduleRef = await Test.createTestingModule({
    imports: [DatabaseModule],
  })
    .overrideProvider(BACKEND_CONFIG)
    .useValue({
      environment: 'test',
      port: 3000,
      databaseUrl: 'postgresql://test:test@localhost:5432/qleanfeel_test',
      databasePoolMax: 2,
    })
    .overrideProvider(POSTGRES_POOL)
    .useValue(pool)
    .compile();

  try {
    assert.ok(moduleRef.get(DRIZZLE_DATABASE));
    assert.ok(moduleRef.get(UnitOfWork) instanceof PostgresUnitOfWork);
  } finally {
    await moduleRef.close();
  }
});
