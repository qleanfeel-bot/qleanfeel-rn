import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../../infrastructure/persistence/database.module.js';
import { PostgresHealthIndicator } from '../../infrastructure/persistence/postgres-health-indicator.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [TerminusModule.forRoot({ logger: false }), DatabaseModule],
  controllers: [HealthController],
  providers: [PostgresHealthIndicator],
})
export class HealthModule {}
