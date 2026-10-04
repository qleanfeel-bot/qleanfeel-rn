import { Module } from '@nestjs/common';
import { HealthModule } from './http/health/health.module.js';
import { DatabaseModule } from './infrastructure/persistence/database.module.js';
import { BackendConfigModule } from './shared/config/backend-config.module.js';
import { IdentityHttpModule } from './http/auth/identity-http.module.js';

@Module({
  imports: [
    BackendConfigModule,
    DatabaseModule,
    HealthModule,
    IdentityHttpModule,
  ],
})
export class AppModule {}
