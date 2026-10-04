# ADR-016: Business Modules, APIs, Transactions, and Home Projection

- **Status:** Accepted architecture — implementation deferred
- **Date:** 2026-10-02
- **Scope:** Future backend/application boundaries; no backend implementation in M6
- **Related:** [M6 architecture proposal](M6_ARCHITECTURE_PROPOSAL.md), [Domain/Data Dictionary](DOMAIN_DATA_DICTIONARY.md)

> **M7 follow-up:** The deferred runtime, persistence, auth/session, command, idempotency, and concurrency choices below are addressed by the approved [M7 Architecture Proposal](M7_ARCHITECTURE_PROPOSAL.md) and [ADR-018](ADR-018-production-backend-foundation.md). This note preserves the M6 decision record; implementation is deferred to M7-B and is not part of the M7-A documentation checkpoint.

## Context

The repository currently contains mobile domain/application/repository/API boundaries and a process-local development HTTP composition. There is no production backend or persistent store. M4 scheduled-order creation performs sequential CalendarEntry and ManualOrder writes with best-effort client compensation; this is not transactional consistency.

## Decision

Begin production backend work as a modular monolith with business-owned Identity/Authorization, Profile, Calendar, Orders, Cleaning, Money/Accounting, and Dashboard projection boundaries. Messaging, Evidence, Disputes, and Settlement remain future independent modules/adapters as described in ADR-017. Each module owns its facts, operations, persistence mapping, API authorization, and lifecycle; a shared database/transaction coordinator initially enforces cross-module invariants. Do not split into services without a concrete operational need.

Keep existing client contracts stable during M6. Future conceptual resources may include `/v1/me/orders`, `/cleanings`, `/dashboard`, and a future money boundary; `/manual-orders` can remain a compatibility adapter to the same canonical Order model. `/me` resolves the caller from verified server authentication, never from caller-supplied owner IDs. Domain entities remain separate from DTOs. Pagination, idempotency, concurrency, and safe error conventions are implementation requirements to decide alongside actual backend contracts, not endpoints or policies created by M6.

Order creation and any requested Cleaning/Calendar scheduling must have a backend consistency boundary so a failed schedule cannot leave a misleading partial creation. Exact command shape and persistence strategy are implementation decisions. Cleaning completion is an explicit work fact. A FinancialEvent or Ledger effect is optional and must follow a separately reviewed financial policy; M6 does not prescribe that it is created in the completion transaction. Refund, expense, adjustment, and payout workflows are future Money/Settlement decisions. Any external side effect needs reliable retry/reconciliation design when that feature is approved.

Cleaning lifecycle events such as `CleaningStarted` and `CleaningCompleted` are first-class business events. Notifications are downstream delivery mechanisms and do not own or calculate business state. A future Client App may consume authorized Order/Cleaning read models and notification events; progress or estimated remaining time is a derived estimate, not authoritative state.

Home consumes a read-only Dashboard projection assembled by an application/backend service from Calendar, Orders, and Cleaning, with optional future Money data. Timezone and `asOf` context are part of the projection contract. Any future financial values require definitions from a separately reviewed Money/accounting design; Home does not invent business facts.

## Consequences

- Current in-memory handlers remain development-only and are not upgraded during M6.
- A production Order create is one server operation, never mobile compensation across independent writes.
- Dashboard can be a materialized projection/cache, but its source remains the owning business modules.
- API authentication, authorization, ownership, idempotency, and transaction behavior require integration tests when implemented.

## Deferred implementation details

The module boundaries and initial modular-monolith direction are approved. Settle resource names and backend consistency, pagination, idempotency, and concurrency conventions when implementation is separately approved.
