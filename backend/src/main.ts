import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApi } from './http/configure-api.js';
import { BACKEND_CONFIG } from './shared/config/backend-config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApi(app);

  const config = app.get(BACKEND_CONFIG);
  await app.listen(config.port, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown startup error';
  process.stderr.write(`Backend startup failed: ${message}\n`);
  process.exitCode = 1;
});
