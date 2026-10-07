# ADR-022 — Order Retrieval Read Path

- **Status:** Accepted architecture decision for M7-B.5
- **Date:** 2026-10-07
- **Scope:** Authenticated current-user Order collection and detail reads
- **Related:** [ADR-018](ADR-018-production-backend-foundation.md), [ADR-019](ADR-019-identity-authentication-foundation.md), [ADR-020](ADR-020-authorization-foundation.md), [ADR-021](ADR-021-canonical-order-creation-and-optional-scheduling.md), [Architecture Map](ARCHITECTURE_MAP.md)

## Context

M7-B.4 establishes canonical production Order creation. A focused read path is the next slice needed to retrieve that business representation through the production backend. It must preserve the canonical model and support later Orders with zero or multiple Cleanings.

## Decision

Provide authenticated endpoints `GET /v1/me/orders?limit&cursor` and `GET /v1/me/orders/:id`. The verified `AuthenticatedPrincipal.userId` determines ownership; clients cannot select an owner. Collection reads are scoped in persistence to the principal. For detail, the application loads resource facts and evaluates the existing resource authorization policy boundary. Missing and non-owned Orders have the same `404` response, so the API does not disclose another user's Order. Missing or invalid authentication remains `401`.

The response is an application/API read representation of the current canonical Order: Order fields, the latest/current OrderTerms revision, `Cleanings[]`, and each Cleaning's optional associated CalendarEntry. It does not return historical terms revisions. The relation remains `Order → 0..N Cleaning → 0..1 CalendarEntry`; CalendarEntry remains Calendar-owned and its status is not proof of work completion. Cleaning remains execution truth. The read model is not a new domain aggregate and does not expose persistence rows.

Collection pagination uses a local opaque cursor representing `(createdAt, id)` and deterministic `createdAt DESC, id DESC` ordering. Keyset continuation avoids duplicates or skipped records under the normal pagination contract. `limit` has a bounded default and maximum; malformed cursor and invalid limits are client errors. Sorting and business filters are not client-selected.

The PostgreSQL adapter performs ordinary reads and joins, scoped by owner for collection queries. Existing schema indexes are used where they support the actual query patterns; add no speculative indexes. GET requests do not use the business UnitOfWork or an application-level read transaction.

Application use cases are `ListMyOrders` and `GetMyOrder`. They depend on a dedicated `OrderReadRepository` port because joined read representations differ from the write-oriented repository responsibilities. Cursor encoding/decoding remains at the HTTP boundary. Do not introduce generic repository, query, pagination, sorting/filter, CQRS, or read-database infrastructure.

## Non-goals

This decision does not add Order mutation, cancellation/deletion, additional Cleaning creation or mutation, assignment, Calendar CRUD, customer search, filters, RBAC/roles/capabilities, policy engines, generic pagination/query frameworks, CQRS, caches, event infrastructure, mobile production migration, or UI redesign.
