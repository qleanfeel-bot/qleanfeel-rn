import assert from 'node:assert/strict';
import test from 'node:test';
import { sql, type SQL } from 'drizzle-orm';
import { Test } from '@nestjs/testing';
import {
  UnitOfWork,
  type UnitOfWorkContext,
} from '../../src/application/ports/unit-of-work.js';
import { DatabaseModule } from '../../src/infrastructure/persistence/database.module.js';
import { TransactionContextRegistry } from '../../src/infrastructure/persistence/transaction-context.registry.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'Set TEST_DATABASE_URL to a dedicated PostgreSQL 18 test database before running test:postgres.',
  );
}

interface DrizzleTransactionQuery {
  execute(query: SQL): Promise<unknown>;
}

test('UnitOfWork shares one live PostgreSQL transaction context and rejects nesting', async () => {
  process.env.APP_ENV ??= 'test';
  process.env.DATABASE_URL ??= testDatabaseUrl;

  const moduleRef = await Test.createTestingModule({
    imports: [DatabaseModule],
  }).compile();
  const unitOfWork = moduleRef.get(UnitOfWork);
  const contextRegistry = moduleRef.get(TransactionContextRegistry);
  let completedContext: UnitOfWorkContext | undefined;

  try {
    await unitOfWork.execute(async context => {
      completedContext = context;
      const transaction = contextRegistry.get<DrizzleTransactionQuery>(context);
      await transaction.execute(sql`SELECT 1`);

      await assert.rejects(
        unitOfWork.execute(async () => undefined),
        /Nested UnitOfWork transactions are not supported/,
      );
    });

    const expiredContext = completedContext;
    assert.ok(expiredContext);
    assert.throws(
      () => contextRegistry.get<DrizzleTransactionQuery>(expiredContext),
      /unknown or no longer active/,
    );
  } finally {
    await moduleRef.close();
  }
});
