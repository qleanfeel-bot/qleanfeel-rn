import { Module, type Provider } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { UnitOfWork } from '../../application/ports/unit-of-work.js';
import { BACKEND_CONFIG } from '../../shared/config/backend-config.js';
import { BackendConfigModule } from '../../shared/config/backend-config.module.js';
import { DRIZZLE_DATABASE, POSTGRES_POOL } from './database.tokens.js';
import { PostgresUnitOfWork } from './postgres-unit-of-work.js';
import { TransactionContextRegistry } from './transaction-context.registry.js';

const providers: Provider[] = [
  {
    provide: POSTGRES_POOL,
    inject: [BACKEND_CONFIG],
    useFactory: (config: { databaseUrl: string; databasePoolMax: number }) =>
      new Pool({
        connectionString: config.databaseUrl,
        max: config.databasePoolMax,
        application_name: 'qleanfeel-backend',
      }),
  },
  {
    provide: DRIZZLE_DATABASE,
    inject: [POSTGRES_POOL],
    useFactory: (pool: Pool) => drizzle(pool),
  },
  TransactionContextRegistry,
  PostgresUnitOfWork,
  {
    provide: UnitOfWork,
    useExisting: PostgresUnitOfWork,
  },
  {
    provide: 'POSTGRES_POOL_SHUTDOWN',
    inject: [POSTGRES_POOL],
    useFactory: (pool: Pool) => ({
      onApplicationShutdown: () => pool.end(),
    }),
  },
];

@Module({
  imports: [BackendConfigModule],
  providers,
  exports: [
    POSTGRES_POOL,
    DRIZZLE_DATABASE,
    UnitOfWork,
    TransactionContextRegistry,
  ],
})
export class DatabaseModule {}
