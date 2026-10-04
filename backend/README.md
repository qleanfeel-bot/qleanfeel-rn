# Qleanfeel backend

This is a separate NestJS application. Its dependencies and lockfile are isolated from the React Native application. Domain and application contracts are framework-free; HTTP, configuration, PostgreSQL, and Drizzle are infrastructure adapters.

## Requirements

- Node.js 22.12 or newer (Node 24 LTS is used in CI)
- npm
- Docker Compose and PostgreSQL 18 for local database work and PostgreSQL integration tests

## Local development

```sh
cd backend
cp .env.example .env
docker compose up -d postgres-local
npm ci
npm run start:dev
```

The backend listens on `PORT` (default `3000`). `GET /health/live` reports process liveness without querying PostgreSQL. `GET /health/ready` performs `SELECT 1` and returns `503` if PostgreSQL is unavailable. Both health endpoints are unauthenticated and excluded from the `/v1` prefix. Business API routes will use `/v1`.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

The HTTP tests start a Nest application with a test double at the PostgreSQL pool boundary; they do not emulate database behavior. To test the real readiness query and UnitOfWork, copy `.env.test.example` to `.env.test`, start the separate test service with `docker compose --env-file .env.test up -d postgres-test`, then run:

```sh
npm run test:postgres
```

This command requires `TEST_DATABASE_URL` to point to a dedicated PostgreSQL 18 test database. It checks connectivity and the server major version; it creates no business tables.

## Migrations and credentials

Drizzle Kit is configured in `drizzle.config.ts`; generated, reviewed SQL migrations belong under `drizzle/`. Commands are:

```sh
npm run db:generate
npm run db:check
npm run db:migrate
```

`db:migrate` is an explicit operator/deployment action. The application never runs migrations at startup, and `drizzle-kit push` is not a deployment workflow. Drizzle Kit requires `MIGRATION_DATABASE_URL`; the application runtime reads only `DATABASE_URL`. Local Compose examples may use one disposable role for convenience. Staging/production must use distinct least-privilege runtime and DDL principals, with DDL rights unavailable to the application runtime.

There are no business tables or migrations in this foundation. The future dedicated application schema is intentionally not created here. Drizzle's migration journal is configured in PostgreSQL's existing `public` schema as infrastructure metadata, separate from business tables.

The application-facing `UnitOfWork` port accepts an opaque transaction context. `PostgresUnitOfWork` creates one Drizzle transaction, registers its context in an infrastructure-only registry, and invalidates it after completion. A nested UnitOfWork is rejected rather than silently opening a second transaction. Future persistence adapters must resolve the transaction they receive from this registry; they must not fall back to the global pool inside a coordinated command.

`.env.example` and `.env.test.example` contain disposable examples only. Never commit actual credentials. Staging and production values must be injected by the deployment secret manager.
