# ADR-021 — Canonical Order Creation and Optional Scheduling

- **Status:** Accepted architecture decision for M7-B.4; production implementation not yet started
- **Date:** 2026-10-06
- **Scope:** `CreateManualOrder`, one initial Cleaning, and optional Calendar scheduling
- **Related:** [M6 architecture proposal](M6_ARCHITECTURE_PROPOSAL.md), [M7 architecture proposal](M7_ARCHITECTURE_PROPOSAL.md), [ADR-011](ADR-011-calendar.md), [ADR-014](ADR-014-canonical-order-and-work-execution.md), [ADR-018](ADR-018-production-backend-foundation.md), [ADR-019](ADR-019-identity-authentication-foundation.md), [ADR-020](ADR-020-authorization-foundation.md), [Architecture Map](ARCHITECTURE_MAP.md)

## Context

M7-B.1 through M7-B.3 established the production backend foundation, identity/authentication, and the framework-independent authorization boundary. The backend does not yet contain production Orders, Cleaning, or Calendar business modules. The current mobile ManualOrder and Calendar path is a development composition that creates separate resources and uses best-effort compensation; it is not the production transaction model.

M7-B.4 establishes the first production business command, `CreateManualOrder`, without implementing a full Orders or Calendar API.

## Decision

### Canonical Order and initial Cleaning

Use the canonical `Order`, not a second production `ManualOrder` aggregate. `Order` and its `OrderTerms` hold the customer, service, and quote snapshots. The quote remains a quote and is not a payment, agreed amount, or accounting fact.

The global relationship is:

```text
Order → 0..N Cleaning
```

Each successful `CreateManualOrder` creates exactly one initial Cleaning in the `planned` state and an Order in the `confirmed` state. This command invariant does not change the global Order-to-Cleaning cardinality. Cleaning records its `orderId`; Order does not keep a mutable `cleaningIds` collection.

### Active-account authorization and trusted identity

For M7-B.4, any active authenticated Qleanfeel account may execute `CreateManualOrder` for itself. The operation-specific decision is conceptually:

```text
active AuthenticatedPrincipal → permit CreateManualOrder
```

Authentication resolves the trusted `AuthenticatedPrincipal`. The authenticated request path has already checked that the account is active; suspended accounts retain the existing `403` behavior. The create operation has no pre-existing Order relationship to load. `createdByUserId` is derived from `principal.userId`. If an initial Cleaning assignment is represented in this slice, it is also derived from that principal.

This is scoped to M7-B.4. It is not the final eligibility model for every future account type. It introduces no `isCleaner` field, role system, RBAC, capability table or registry, permission engine, or new authorization infrastructure. A later product decision may add stricter eligibility for future account types.

### Client intent and server-authored facts

The authenticated client may provide customer/service terms and, when scheduling is requested, `schedule.startAt` and `schedule.endAt`. These are requested appointment instants and follow the UTC/interval semantics in ADR-011. If a schedule is supplied, both bounds must be valid and `startAt < endAt`.

The server authors IDs, `createdAt`, `updatedAt`, event-recording timestamps, version, `origin=manual`, Order/Cleaning lifecycle status, `createdByUserId`, and any assignment or ownership facts. Client claims for those fields are rejected or ignored and are never authorization facts. `createdByUserId` comes only from `AuthenticatedPrincipal.userId`.

### HTTP boundary

The production command is `POST /v1/me/orders`, protected by the existing Qleanfeel access authentication path. The HTTP adapter passes the server-resolved principal and validated business input to the application use case; it does not accept a caller identity. Authentication failures remain `401`, while denial of an authenticated request is `403`. M7-B.4 adds no other Orders routes or Calendar CRUD/read/list routes.

### Calendar ownership and optional scheduling

`CalendarEntry` remains Calendar-owned and represents a planned appointment or standalone availability block. Cleaning holds the optional current reference:

```text
Cleaning → 0..1 CalendarEntry
```

CalendarEntry does not directly reference an Order or Cleaning and does not establish whether work was performed. Calendar status `completed` is not proof that Cleaning was performed; Cleaning owns execution truth. Scheduling is optional. M7-B.4 adds no full Calendar CRUD, read, or list API; the use case coordinates Calendar-owned creation through an application boundary.

### One atomic UnitOfWork

The complete `CreateManualOrder` persistence operation runs within one UnitOfWork backed by one database transaction. That transaction includes:

1. The Order.
2. Initial OrderTerms.
3. Exactly one initial Cleaning.
4. The optional CalendarEntry when a schedule was requested.
5. The Cleaning-to-CalendarEntry relation.

All writes use the same transaction context. They all commit or all roll back. Calendar does not open an independent transaction. The command uses no nested UnitOfWork, separate business transaction, best-effort compensation, or partial persistence. If requested scheduling fails, Order, terms, Cleaning, and any attempted schedule writes roll back together.

The use case owns orchestration. Module repositories are accessed through application ports. Authorization policy does not load resources, access persistence, open a transaction, or own orchestration.

### Idempotency deferral

M7-B.4 does not implement generic API idempotency. It adds no idempotency table, middleware, service, or reusable framework. This explicitly defers the earlier general durable-idempotency requirement for `CreateManualOrder` to a future API reliability slice; no milestone number is assigned.

A retry after the server commits but before the client receives the response can create a duplicate Order. That is a known risk until the separately scoped reliability work is approved and implemented. This decision does not change authentication/session rotation behavior.

## Non-goals

M7-B.4 does not add a full Orders API, full Calendar API, customer aggregate, payments, Money/Ledger, expenses, tax, notifications, messaging, evidence/photos, disputes, settlement, RBAC, role hierarchy, capability persistence/administration, a generic policy engine, generic idempotency infrastructure, Web3, a Client App, UI redesign, or mobile Order migration implementation.

## Consequences

- The first real business path can exercise authentication, `AuthenticatedPrincipal`, authorization, application orchestration, domain behavior, one UnitOfWork, and PostgreSQL.
- Current M4 mobile contracts remain development compatibility contracts until a separately approved client migration.
- M7-B.4 writes no business persistence outside the single transaction and introduces no persistence for authorization or idempotency.
- The eligibility rule is intentionally broad only for this slice and must not be assumed for future account types.
