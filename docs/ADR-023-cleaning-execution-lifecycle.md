# ADR-023 — Cleaning Execution Lifecycle

- **Status:** Accepted implementation decision for M7-B.6
- **Date:** 2026-10-08
- **Scope:** Owner-authorized Cleaning execution transitions and durable transition history
- **Related:** [ADR-018](ADR-018-production-backend-foundation.md), [ADR-020](ADR-020-authorization-foundation.md), [ADR-021](ADR-021-canonical-order-creation-and-optional-scheduling.md), [ADR-022](ADR-022-order-retrieval-read-path.md), [Architecture Map](ARCHITECTURE_MAP.md)

## Context

The canonical model is `Order → 0..N Cleaning → 0..1 CalendarEntry`. M7-B.4 creates an initial planned Cleaning; M7-B.5 reads its state. This slice adds the first production execution lifecycle without conflating the execution state of Cleaning with Order lifecycle or Calendar scheduling state.

## Decision

`Cleaning.status` is authoritative for execution truth only. The allowed transitions are:

```text
planned → in_progress | cancelled | not_performed
in_progress → completed | partially_completed | not_performed
```

`completed`, `partially_completed`, `not_performed`, and `cancelled` are terminal in this milestone. There are no ordinary reverse transitions. `cancelled` means planned work was cancelled before it should execute. `not_performed` means an occurrence existed as planned work but was not performed. `completed` and `partially_completed` describe full and partial execution respectively. Partial completion carries no generic performed-scope payload.

`startedAt` is set on `planned → in_progress` and remains historical. `completedAt` is set on `completed`, `partially_completed`, and `not_performed`; it remains null for `cancelled`, because cancellation before execution is not work completion. Both are server-authored. Existing `version` increments once per transition.

Each transition appends a relational `CleaningLifecycleEvent` containing event ID, Cleaning ID, event type, actor User ID, `occurredAt`, `recordedAt`, and the resulting Cleaning version. The event is durable business history, not an event bus or distributed architecture. A unique `(cleaning_id, version)` key prevents duplicate history entries for one state revision. No event payload is added.

Every command uses one existing UnitOfWork. It loads Cleaning and its Order-owner fact, evaluates the operation-specific resource policy, applies the domain transition, compare-and-set updates by the loaded version, appends the event, and commits. State update and event insertion roll back together. A stale version or invalid transition maps to `409 Conflict`.

The trusted `AuthenticatedPrincipal.userId` may operate only on Cleanings whose Order is owned by that principal. Resource facts are loaded outside the pure policy. A missing or non-owned Cleaning has the same `404` response to conceal resource existence. The existing authentication boundary continues to return `401` for missing/invalid authentication and `403` for suspended accounts.

Lifecycle commands are explicit: `start`, `complete`, `partially-complete`, `cancel`, and `not-performed`. They return the current Cleaning representation. They do not mutate `Order.status` or `CalendarEntry.status`; Calendar remains scheduling state and is not proof of work. Order lifecycle remains independent.

## M7-B.7 — Retrieval and lifecycle history

`GET /v1/me/cleanings/:id` reads the current canonical Cleaning row, including its current status, relationship IDs, lifecycle timestamps, creation/update timestamps, and version. It does not reconstruct state from events. `GET /v1/me/cleanings/:id/lifecycle` is a separate read use case over the existing `cleaning_lifecycle_events` table and returns the canonical event fields (`id`, `cleaningId`, `eventType`, `actorUserId`, `occurredAt`, `recordedAt`, and `version`). No event payload or second history representation is introduced.

Lifecycle events are returned oldest first by `occurredAt`, with `version` ascending as the deterministic tie-breaker. The version is unique within one Cleaning by the existing `(cleaning_id, version)` constraint and reflects its transition order. The existing event lookup needs no new index or migration.

Both reads resolve Cleaning and its Order owner fact in the application-facing read repository, then apply a pure resource policy. The principal may read only when its user ID owns the Order. Missing and non-owned Cleanings both map to `404`. Reads are ordinary queries outside UnitOfWork; the existing atomic state-plus-event write transaction remains the consistency guarantee. A history request returns committed events visible to that query under normal PostgreSQL read semantics.

The event table remains immutable business history, not the source of current Cleaning truth, event sourcing, or a generic audit/event framework. History is available only through the dedicated lifecycle endpoint; it is not embedded in the current Cleaning representation.

## WorkAcceptance and settlement boundary

Future `WorkAcceptance` is separate from Cleaning execution status and may eventually carry worker and client confirmation for physical work beyond cleaning. M7-B.6 does not implement WorkAcceptance, either confirmation, proof-of-work, or customer permissions. The backend remains authoritative for execution and any future acceptance facts.

Future settlement eligibility may depend on completed execution plus separately established confirmations. Settlement is a later infrastructure boundary; Web3 or another mechanism would be an adapter and never the source of truth for Cleaning execution. M7-B.6 adds no settlement, Web3, or smart-contract dependency.

## Non-goals

This decision does not add assignment/matching, RBAC, customer confirmation, worker confirmation, evidence, GPS verification, disputes, corrections UI, payments, ledger, settlement, notifications, messaging, Calendar CRUD/rescheduling, Order lifecycle mutation, automatic Order fulfillment/cancellation, generic state-machine/repository/idempotency frameworks, event bus, CQRS, caching, mobile production integration, or analytics.
