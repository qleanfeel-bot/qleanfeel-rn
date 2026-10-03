import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PostgresHealthIndicator } from '../../infrastructure/persistence/postgres-health-indicator.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthCheckService)
    private readonly healthCheckService: HealthCheckService,
    @Inject(PostgresHealthIndicator)
    private readonly postgresHealthIndicator: PostgresHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  liveness() {
    return this.healthCheckService.check([]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.healthCheckService.check([
      () => this.postgresHealthIndicator.isHealthy(),
    ]);
  }
}
