# ADR-018 — Production Backend Foundation

- **Status:** Accepted — architecture approved; implementation deferred to M7-B
- **Date:** 2026-10-03
- **Scope:** M7 Production Backend Foundation; architecture decision for M7-A, with implementation deferred to M7-B
- **Supersedes:** M6's deferred implementation choices where this proposal now makes an explicit selection; the historical M6 record remains unchanged
- **Related:** [M6 proposal](M6_ARCHITECTURE_PROPOSAL.md), [ADR-014](ADR-014-canonical-order-and-work-execution.md), [ADR-016](ADR-016-business-modules-api-transactions-and-home.md), [ADR-017](ADR-017-messaging-evidence-and-settlement-boundaries.md)

## Context

M6 established the canonical business model and modular-monolith boundaries while explicitly deferring backend runtime, database, ORM, concrete auth/session architecture, and detailed application consistency policies. The mobile repository still contains development-only in-memory handlers, not a production backend. M7 records the human-approved production foundation; backend implementation remains outside this M7-A documentation checkpoint.

## Proposed decision

1. Use NestJS as the HTTP/composition/infrastructure runtime. Keep Domain and Application framework-free.
2. Use PostgreSQL 18.x, latest supported stable minor on the selected host, one application schema, UUIDv7 identifiers, UTC `timestamptz`, and explicit IANA timezone IDs where local schedule interpretation is required. Use managed PostgreSQL for staging/production and separate environment databases/instances and runtime/migration principals.
3. Use Drizzle ORM with `pg`, behind repository ports and a shared application-facing UnitOfWork. All participating repositories in a business command use the same transaction context.
4. Preserve M6's `Order 1 → 0..N Cleaning`, with each Cleaning optionally referencing one current independently Calendar-owned CalendarEntry. Production manual creation creates a confirmed Order, one planned Cleaning, and optional CalendarEntry atomically. `ManualOrder` remains a compatibility adapter only.
5. Use provider-independent Qleanfeel identity/session architecture, initially bootstrapped by verifying Firebase identity proof. Protected API requests use Qleanfeel access credentials and Qleanfeel per-device sessions with rotating refresh credentials; store only refresh-token hashes. Exact token lifetimes and several lifecycle policies remain deferred.
6. Authorize through authenticated principal, active account/capability, resource policy, relationship (ownership/assignment/participation), and allowed state transition. Never trust client claims of user, owner, creator, role, origin, assignment, or participation.
7. Require backend transactions for cross-resource invariants, durable scoped idempotency for retry-sensitive mutating commands, and integer optimistic-concurrency versions.
8. Preserve Calendar's M3 UTC instant and half-open interval model. No overlap rule or database exclusion constraint is approved.
9. Do not require an outbox for the first implementation. Money/Accounting, Messaging, Evidence, Disputes, Settlement, Web3, Client App, and production UI redesign remain outside M7 implementation.

The complete command, data, module, API, operations, mobile-impact, and implementation boundary is specified in [M7_ARCHITECTURE_PROPOSAL.md](M7_ARCHITECTURE_PROPOSAL.md). That approved proposal is the detailed canonical M7 architecture; this ADR is its decision index.

### Later M7-B.4 clarification

For `CreateManualOrder`, the later operation-specific [ADR-021](ADR-021-canonical-order-creation-and-optional-scheduling.md) explicitly defers durable API idempotency to a future API reliability slice. This narrows decision 7 for that command only; it does not settle retry policy for other commands.

## Consequences

- Production backend work belongs to the separate M7-B implementation phase and is not part of this documentation checkpoint.
- M1–M5 code and contracts are not retroactively changed. Client migration from the M4 two-request create flow is required before that flow is used against production.
- M6 ADRs remain historical architecture records. This ADR supersedes only their expressly deferred choices and does not redefine M6's business facts.
- Deferred items listed in the M7 proposal remain open and must be decided before a feature depends on them.
