import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApi } from '../src/http/configure-api.js';
import { BACKEND_CONFIG } from '../src/shared/config/backend-config.js';
import { POSTGRES_POOL } from '../src/infrastructure/persistence/database.tokens.js';

interface TestPool {
  query: () => Promise<unknown>;
  end: () => Promise<void>;
}

async function createHttpApplication(pool: TestPool) {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
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

  const app = moduleRef.createNestApplication();
  configureApi(app);
  await app.init();
  return { app, moduleRef };
}

test('starts the test application and serves liveness without checking PostgreSQL', async () => {
  let queryCount = 0;
  const { app, moduleRef } = await createHttpApplication({
    query: async () => {
      queryCount += 1;
      return {};
    },
    end: async () => undefined,
  });

  try {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect(({ body }) => assert.equal(body.status, 'ok'));
    assert.equal(queryCount, 0);
  } finally {
    await app.close();
    await moduleRef.close();
  }
});

test('readiness checks PostgreSQL and returns unavailable when its query fails', async () => {
  let queryCount = 0;
  const { app, moduleRef } = await createHttpApplication({
    query: async () => {
      queryCount += 1;
      throw new Error('password=must-not-leak');
    },
    end: async () => undefined,
  });

  try {
    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);

    assert.equal(queryCount, 1);
    assert.equal(response.body.status, 'error');
    assert.doesNotMatch(JSON.stringify(response.body), /must-not-leak/);
  } finally {
    await app.close();
    await moduleRef.close();
  }
});

test('authentication endpoints validate input and protected endpoints require a credential', async () => {
  const { app, moduleRef } = await createHttpApplication({
    query: async () => ({ rows: [] }),
    end: async () => undefined,
  });

  try {
    await request(app.getHttpServer())
      .post('/v1/auth/bootstrap')
      .send({ firebaseIdToken: '' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: '' })
      .expect(400);
    await request(app.getHttpServer()).get('/v1/me').expect(401);
    await request(app.getHttpServer()).post('/v1/auth/logout').expect(401);
  } finally {
    await app.close();
    await moduleRef.close();
  }
});
