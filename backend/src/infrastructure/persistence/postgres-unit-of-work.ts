import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  UnitOfWork,
  type UnitOfWorkContext,
} from '../../application/ports/unit-of-work.js';
import { DRIZZLE_DATABASE } from './database.tokens.js';
import { TransactionContextRegistry } from './transaction-context.registry.js';

type DrizzleDatabase = NodePgDatabase;
type DrizzleTransaction = Parameters<
  Parameters<DrizzleDatabase['transaction']>[0]
>[0];

@Injectable()
export class PostgresUnitOfWork extends UnitOfWork {
  private readonly activeContext = new AsyncLocalStorage<UnitOfWorkContext>();

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DrizzleDatabase,
    @Inject(TransactionContextRegistry)
    private readonly contextRegistry: TransactionContextRegistry,
  ) {
    super();
  }

  execute<T>(
    operation: (context: UnitOfWorkContext) => Promise<T>,
  ): Promise<T> {
    if (this.activeContext.getStore()) {
      throw new Error(
        'Nested UnitOfWork transactions are not supported; pass the active transaction context.',
      );
    }

    return this.database.transaction(async transaction => {
      const context =
        this.contextRegistry.create<DrizzleTransaction>(transaction);
      try {
        return await this.activeContext.run(context, () => operation(context));
      } finally {
        this.contextRegistry.release(context);
      }
    });
  }
}
