import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBackendConfig } from '../src/shared/config/backend-config.js';

test('loads explicit backend configuration with safe defaults', () => {
  assert.deepEqual(
    loadBackendConfig({
      APP_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/qleanfeel_test',
    }),
    {
      environment: 'test',
      port: 3000,
      databaseUrl: 'postgresql://test:test@localhost:5432/qleanfeel_test',
      databasePoolMax: 10,
    },
  );
});

test('rejects invalid environment names, database protocols, and numeric settings', () => {
  assert.throws(
    () =>
      loadBackendConfig({
        APP_ENV: 'preview',
        DATABASE_URL: 'postgresql://test:test@localhost/test',
      }),
    /APP_ENV/,
  );

  assert.throws(
    () =>
      loadBackendConfig({
        APP_ENV: 'production',
        DATABASE_URL: 'mysql://user:password@localhost/database',
      }),
    /PostgreSQL/,
  );

  assert.throws(
    () =>
      loadBackendConfig({
        APP_ENV: 'local',
        DATABASE_URL: 'postgresql://user:password@localhost/database',
        PORT: '70000',
      }),
    /PORT/,
  );
});

test('requires a database URL for application startup', () => {
  assert.throws(() => loadBackendConfig({ APP_ENV: 'test' }), /DATABASE_URL/);
});
