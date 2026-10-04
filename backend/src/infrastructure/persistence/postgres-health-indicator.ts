import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { Pool } from 'pg';
import { POSTGRES_POOL } from './database.tokens.js';

@Injectable()
export class PostgresHealthIndicator {
  constructor(
    @Inject(POSTGRES_POOL) private readonly pool: Pool,
    @Inject(HealthIndicatorService)
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  isHealthy() {
    return this.healthIndicatorService
      .check('postgresql')
      .attempt(async () => {
        try {
          await this.pool.query('SELECT 1');
        } catch {
          throw new Error('PostgreSQL is unavailable.');
        }
      })
      .withTimeout(1500);
  }
}
