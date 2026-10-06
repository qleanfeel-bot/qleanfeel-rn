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

The backend listens on `PORT` (default `3000`). `GET /health/live` reports process liveness without querying PostgreSQL. `GET /health/ready` performs `SELECT 1` and returns `503` if PostgreSQL is unavailable. Both health endpoints are unauthenticated and excluded from the `/v1` prefix.

The identity endpoints are `POST /v1/auth/bootstrap`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, and authenticated `GET /v1/me`. M7-B.4 adds authenticated `POST /v1/me/orders` to create a canonical manual Order, its initial terms and Cleaning, and optionally a Calendar-owned schedule in one transaction. Bootstrap accepts a Firebase ID token, verifies it through Firebase Admin using Application Default Credentials, and creates/resolves a Qleanfeel User and per-device session. Set `FIREBASE_PROJECT_ID` and `ACCESS_TOKEN_SIGNING_SECRET` for authentication; the signing secret must be at least 32 bytes. Never put real credentials in `.env.example` or commit local `.env` files.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

The HTTP tests start a Nest application with a test double at the PostgreSQL pool boundary; they do not emulate database behavior. To run the real PostgreSQL integration tests, copy `.env.test.example` to `.env.test`, start the separate test service with `docker compose --env-file .env.test up -d postgres-test`, apply migrations, then run:

```sh
npm run db:migrate
npm run test:postgres
```

These commands require `MIGRATION_DATABASE_URL` and `TEST_DATABASE_URL` to point to the dedicated PostgreSQL 18 test database. The PostgreSQL integration suite checks connectivity, schema constraints, identity provisioning races, token rotation, session revocation, and M7-B.4 scheduled/unscheduled Order creation and transaction rollback.

## Migrations and credentials

Drizzle Kit is configured in `drizzle.config.ts`; generated, reviewed SQL migrations belong under `drizzle/`. Commands are:

```sh
npm run db:generate
npm run db:check
npm run db:migrate
```

`db:migrate` is an explicit operator/deployment action. The application never runs migrations at startup, and `drizzle-kit push` is not a deployment workflow. Drizzle Kit requires `MIGRATION_DATABASE_URL`; the application runtime reads only `DATABASE_URL`. Local Compose examples may use one disposable role for convenience. Staging/production must use distinct least-privilege runtime and DDL principals, with DDL rights unavailable to the application runtime.

The initial migration creates the dedicated `qleanfeel` schema and four identity/session tables: `users`, `auth_identities`, `auth_sessions`, and `session_refresh_tokens`. M7-B.4 adds `orders`, `order_terms`, `cleanings`, and Calendar-owned `calendar_entries`; no Profile, Dashboard, Money, capability, or idempotency tables are included. Drizzle's migration journal remains in PostgreSQL's existing `public` schema as infrastructure metadata.

The application-facing `UnitOfWork` port accepts an opaque transaction context. `PostgresUnitOfWork` creates one Drizzle transaction, registers its context in an infrastructure-only registry, and invalidates it after completion. A nested UnitOfWork is rejected rather than silently opening a second transaction. Future persistence adapters must resolve the transaction they receive from this registry; they must not fall back to the global pool inside a coordinated command.

`.env.example` and `.env.test.example` contain disposable examples only. Never commit actual credentials. Staging and production values must be injected by the deployment secret manager.

Authentication implementation choices and deferred decisions are recorded in [ADR-019](../docs/ADR-019-identity-authentication-foundation.md).
