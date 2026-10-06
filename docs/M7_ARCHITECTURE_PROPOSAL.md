# M7 — Production Backend Foundation

- **Status:** Approved architecture; M7-B.1–B.3 implemented and merged; M7-B.4 architecture recorded, implementation not started
- **Baseline:** M6 architecture in [M6_ARCHITECTURE_PROPOSAL.md](M6_ARCHITECTURE_PROPOSAL.md), [ADR-014](ADR-014-canonical-order-and-work-execution.md), [ADR-016](ADR-016-business-modules-api-transactions-and-home.md), and [ADR-017](ADR-017-messaging-evidence-and-settlement-boundaries.md)
- **Historical code baseline:** M7-A began from `59c2636989f5abea5b936c936c7308fb5db3b052` (M5). This records the proposal's original baseline, not the current repository state.
- **Related decision record:** [ADR-018 — Production Backend Foundation](ADR-018-production-backend-foundation.md)

This proposal records the approved M7 architecture. M7-B.1–B.3 are implemented on `main`. The M7-B.4 business architecture is specified by [ADR-021](ADR-021-canonical-order-creation-and-optional-scheduling.md); its production implementation remains separately gated. Current implementation status is tracked in [ROADMAP.md](ROADMAP.md).

## 1. Scope

**M7 — Production Backend Foundation** establishes the production backend architecture and its implementation boundary. It covers the modular-monolith runtime, persistence and data-access boundaries, identity/session model, authorization, canonical commands, API boundaries, operational environments, and a migration path from the current in-memory mobile development composition.

M7 does not implement or design product policy for:

- Money/accounting, tax, payments, earnings, balances, or financial ledger behavior;
- messaging, evidence, disputes, settlement, or Web3;
- the future Client App or marketplace workflows;
- production UI redesign.

Those areas remain future independent boundaries. Core backend abstractions must not prevent them, but M7 does not create their aggregates or workflows.

## 2. Architecture overview

```text
Mobile / future clients
        ↓
      HTTP API
        ↓
      NestJS
        ↓
 Application layer
        ↓
     Domain modules
        ↓
 Repository ports
        ↓
 Persistence adapters
        ↓
    Drizzle + pg
        ↓
    PostgreSQL
```

NestJS owns HTTP delivery, dependency composition, guards/interceptors at the edge, and infrastructure integration. Domain rules and application use cases remain framework-free TypeScript. NestJS decorators, request/response types, Drizzle types, SQL rows, and provider SDK types must not enter domain entities or application ports.

The backend is a modular monolith. It starts as one deployable application and one PostgreSQL database per environment, with explicit module ownership and transactional coordination. Splitting services is deferred until a concrete operational requirement exists.

## 3. Module boundaries and ownership

| Module | Authoritative facts and responsibilities |
| --- | --- |
| Identity / Authorization | Qleanfeel User, provider AuthIdentity links, sessions, account status, authentication resolution, and resource policies. A general capability model remains a future decision; no capability persistence or administration is part of M7-B.1–B.4. |
| Profile | User-facing profile fields. It does not own authentication identity, capabilities, or service/legal jurisdiction. |
| Calendar | CalendarEntry intervals, types, Calendar lifecycle, availability blocks, and schedule updates. It is authoritative for schedule facts. |
| Orders | Order origin, creator, customer and service/price term snapshots, Order lifecycle, and Order lifecycle history. |
| Cleaning | Execution occurrence, occurrence-specific cleaner assignment, execution state, and Cleaning lifecycle history. A Cleaning references its current CalendarEntry; it does not own CalendarEntry. |
| Dashboard | Read-only, permission-filtered projection assembled from owning modules. It owns no business facts and cannot issue business state changes. |

Future independent boundaries are Money / Accounting, Messaging, Evidence, Disputes, and Settlement, as framed by M6 ADR-015/017. Web3 is an optional future settlement rail, not an identity or work-truth boundary. Client App is a future client, not a backend domain module by itself.

Modules access another module through its published application query/command ports or an approved read projection. They must not import another module's ORM model, repository implementation, or private domain internals. Composite application use cases coordinate module ports through one UnitOfWork. Dependencies must remain acyclic; in particular, Orders must not call Cleaning while Cleaning calls Orders. Cleaning may reference an Order ID and use a narrow Orders query/policy port where an invariant requires it; Orders obtains its Cleaning list through a query/projection rather than owning Cleaning records.

Facts have one owner. Do not duplicate mutable customer/order terms in Cleaning or Calendar, schedule timestamps in Orders/Cleaning, execution status in Calendar, financial totals in Dashboard, or messages/photos/payments as nested Order collections. Cross-module IDs and read projections are references, not ownership transfers.

An optional Order-level assigned cleaner describes assignment of the overall Order/work relationship; a Cleaning-level assigned cleaner describes who is assigned to that specific occurrence. They are distinct scoped facts because recurring Cleanings can be assigned separately. If the product later requires only one assignment scope, remove the redundant scope through an explicit decision rather than mirroring one value in two tables.

## 4. Canonical domain model

```text
Order 1 ── 1..N OrderTerms revisions
Order 1 ── 0..N Cleaning
Cleaning 0..1 ── current CalendarEntry
```

An Order records the work/agreement and its terms. A Cleaning is one execution occurrence; recurring work can have multiple Cleanings, and the canonical Order model permits an Order to exist before any Cleaning. Current manual creation creates one initial planned Cleaning. A CalendarEntry records scheduled or unavailable time and remains independently owned by Calendar. Standalone personal/blocked entries are valid without an Order or Cleaning, and Calendar retains its own lifecycle and range queries. A Cleaning's nullable `calendarEntryId` is the current schedule reference, not ownership of that CalendarEntry.

The initial manual command produces a confirmed `Order(origin=manual)`, one planned Cleaning, and an optional CalendarEntry, atomically. An Order may be unscheduled. CalendarEntry may exist without Cleaning. Rescheduling updates the current CalendarEntry; cancellation retains a historical entry and may set its Calendar state to cancelled. M6 does not establish a universal no-overlap rule; do not add an overlap constraint until product policy is approved.

`ManualOrder` remains a compatibility adapter/model for current M4 behavior only. Production has one canonical Order aggregate. The former M4 `calendarEntryId` maps to the initial Cleaning's current schedule reference. M4 customer name/phone, service description/address, quoted price, and notes must be preserved as an order-time terms snapshot. A quote remains a quote and must not be reinterpreted as an agreed amount or accounting fact.

## 5. Production command model

Commands express validated intent and enforce lifecycle rules. Lifecycle state is not changed through a generic `PATCH { status }`: that would allow callers to bypass actor authorization, state-transition rules, event history, atomic cross-module invariants, and command idempotency. CRUD is appropriate for replaceable profile attributes and standalone Calendar metadata when it does not bypass a business transition.

| Command | Owner / actor and authorization | Transaction, retry, and version behavior | Expected facts / transition |
| --- | --- | --- | --- |
| `ResolveAuthenticatedIdentity` | Identity; verified provider subject only. Provider credential must be verified by its adapter. | Atomic AuthIdentity/User resolution and session creation; idempotent bootstrap semantics; unique provider+subject mapping. | Resolve or provision User and establish a Qleanfeel session; never accepts caller-supplied user identity. |
| `UpdateProfile` | Profile; authenticated User updating own Profile, subject to active-account policy. | One write; retry-safe desired-state update; Profile version required for stale-write protection. | Profile fields change; audit only if a field/security policy requires it. |
| `CreateManualOrder` | Orders orchestration; any active authenticated Qleanfeel account creating for itself under ADR-021. `createdByUserId` and any initial Cleaning assignment are derived from `AuthenticatedPrincipal.userId`. | One UnitOfWork/transaction across Order, initial OrderTerms, exactly one initial Cleaning, optional CalendarEntry, and the Cleaning-to-CalendarEntry relation. No generic idempotency in B4. | `Order confirmed` + one `Cleaning planned` + optional current schedule. |
| `ScheduleCleaning` | Cleaning command port plus Calendar schedule operation; assigned/authorized cleaner or other actor granted by policy. | Shared transaction; idempotent command; expected Cleaning and Calendar versions. | Creates a CalendarEntry and links it as current schedule on Cleaning; records schedule fact/history. |
| `RescheduleCleaning` | Same relationship policy as scheduling; actor must be authorized for both work and schedule. | Shared transaction; idempotent; expected versions for Cleaning and CalendarEntry. | Updates the current CalendarEntry interval and version; retains entry identity; records reschedule lifecycle/audit fact. |
| `CancelCleaning` | Cleaning; authorized creator/assigned cleaner or future participant policy, subject to current state. | Shared transaction with Calendar cancellation; idempotent; expected Cleaning and Calendar versions. | Cleaning transitions to cancelled/not-performed according to approved reason/state mapping; current CalendarEntry is retained and may become cancelled; record actor/reason/time. |
| `StartCleaning` | Cleaning; assigned cleaner or explicit policy-authorized actor. | Atomic transition/event; idempotent; expected Cleaning version. | `planned → in_progress`; append `CleaningStarted` with actor and instant. |
| `CompleteCleaning` | Cleaning; assigned cleaner or explicit policy-authorized actor. | Atomic transition/event; idempotent; expected Cleaning version. | `in_progress → completed`; append `CleaningCompleted`; Calendar closure may be coordinated, but Calendar completion is never proof of work. No Money/Ledger write is implied. |
| `PartiallyCompleteCleaning` | Cleaning; same execution authorization as completion, with required partial outcome data. | Atomic transition/event; idempotent; expected Cleaning version. | Transition to `partially_completed`; append event and preserve correction/audit context. Financial consequences remain out of scope. |
| `CancelOrder` | Orders; creator/owner or future participant with an explicit cancellation capability and permitted lifecycle state. | Coordinate dependent Cleaning/Calendar effects in one transaction; idempotent; expected Order version and versions of changed dependents. | Order transitions to cancelled; dependent future work follows an explicit cancellation policy; append Order and any Cleaning/Calendar lifecycle facts. |
| `CreateCalendarEntry` | Calendar; authenticated principal with Calendar capability; standalone personal/blocked entries can be created without Order/Cleaning. | One transaction; idempotent; Calendar version initialized. If linked to Cleaning, coordinate through ScheduleCleaning rather than generic create. | Creates Calendar-owned entry; schedule-specific entry events/audit as defined by the Calendar boundary. |
| `UpdateCalendarEntry` | Calendar; owner/authorized participant and applicable entry policy. | One transaction; idempotent for retryable writes; expected CalendarEntry version. Linked Cleaning schedules must use `RescheduleCleaning`. | Updates allowed Calendar-owned metadata/time; append audit/lifecycle fact when semantically significant. |
| `DeleteCalendarEntry` | Calendar; Calendar owner/policy, only when no business relationship or history invariant forbids deletion. | One transaction; idempotent; expected CalendarEntry version. Linked current Cleaning schedule must use a business cancellation/reschedule command. | Deletes only an eligible standalone entry; otherwise reject with conflict. No blanket soft delete. |
| `GetDashboard` | Dashboard; authenticated principal and per-row read policy. | Read-only consistent projection; no idempotency or write version. | Read model with `asOf` and requested IANA timezone; does not create or alter facts. |

Command ports belong to their owning module. Application orchestration and the shared UnitOfWork coordinate multi-module invariants. The transaction coordinator is infrastructure exposed through an application-facing port; it does not become a business module or accept arbitrary HTTP logic.

## 6. Persistence architecture

### Topology and schema

- PostgreSQL **18.x**, using the latest supported stable minor offered by the selected production host; do not pin to an unsupported minor or preview major.
- Separate local, test, staging, and production databases/instances. Tests use PostgreSQL-compatible behavior rather than substituting an in-memory database for relational/transaction tests.
- Managed PostgreSQL is the production and staging assumption. No cloud host/provider is selected here.
- Use one dedicated application schema for the modular monolith. Module/table ownership is enforced by code boundaries and repository ownership, not by premature per-module database schemas.
- Use separate least-privilege runtime and migration principals. Runtime credentials cannot create/alter schema; migration credentials are used only by controlled migration jobs.

### Storage conventions

- Use UUIDv7 IDs generated by trusted application/database infrastructure and immutable after creation.
- Persist instants as PostgreSQL `timestamptz`; application/API values are normalized to UTC. Store an explicit IANA timezone identifier when interpreting local schedule/calendar dates. A UTC instant alone is not a timezone preference.
- Use `text` plus named `CHECK` constraints for lifecycle values so changes are explicit and migration-managed. Do not use PostgreSQL enum types for frequently evolving state vocabularies.
- Use JSONB only for genuinely variable, versioned snapshots or event payloads. Queryable stable facts remain typed relational columns with constraints/indexes.
- No blanket soft-delete policy. Use explicit cancellation/lifecycle state or audited lifecycle records where business history matters; delete eligible standalone data only under an explicit retention policy.
- Keep event/audit facts append-only for business lifecycle changes, with actor, event type, occurrence/recording instant, and versioned payload as needed. Current state is a queryable projection updated atomically with its lifecycle record.
- Use integer optimistic-concurrency `version` fields on mutable Profile, Order, Cleaning, and CalendarEntry records. `updatedAt` is metadata, not a concurrency token.

### Conceptual relational map

This is a logical mapping, not a migration or final column-by-column schema:

```text
users(id PK, status, created_at, updated_at, version)
auth_identities(id PK, user_id FK→users, provider, provider_subject,
                created_at, last_authenticated_at,
                UNIQUE(provider, provider_subject))
auth_sessions(id PK, user_id FK→users, status, created_at, expires_at,
              revoked_at, device/session metadata)
session_refresh_tokens(id PK, session_id FK→auth_sessions, token_hash UNIQUE,
                       created_at, expires_at, consumed_at, revoked_at, replaced_by_id)
user_capabilities(user_id FK→users, capability, granted_at, revoked_at, ...)
profiles(user_id PK/FK→users, editable profile fields, created_at, updated_at, version)
orders(id PK, origin, created_by_user_id FK→users, customer_user_id nullable FK→users,
       assigned_cleaner_user_id nullable FK→users, status, created_at, updated_at, version)
order_terms(id PK, order_id FK→orders, revision, customer/service/address snapshots,
            quote snapshot, notes, created_at, UNIQUE(order_id, revision))
cleanings(id PK, order_id FK→orders, assigned_cleaner_user_id nullable FK→users,
          calendar_entry_id nullable UNIQUE FK→calendar_entries(id), status,
          created_at, updated_at, version)
calendar_entries(id PK, owner_user_id FK→users, type, status, title,
                 start_at, end_at, timezone_id nullable, created_at, updated_at, version,
                 CHECK(start_at < end_at))
order_lifecycle_events(id PK, order_id FK→orders, version, event_type, actor, occurred_at, payload)
cleaning_lifecycle_events(id PK, cleaning_id FK→cleanings, version, event_type, actor, occurred_at, payload)
calendar_lifecycle_events(id PK, calendar_entry_id FK→calendar_entries, version, event_type, actor, occurred_at, payload)
```

The earlier conceptual `user_capabilities` row in this proposal is not current schema and is not part of M7-B.1–B.4. M7-B.4 also removes the previously proposed `idempotency_records` table from its persistence scope; see the idempotency decision in §11 and [ADR-021](ADR-021-canonical-order-creation-and-optional-scheduling.md).

`cleanings.calendar_entry_id` is a nullable unique reference to a Calendar-owned entry. The FK direction and `calendar_entries.owner_user_id` preserve Calendar ownership; deletion of a referenced entry is restricted until the Cleaning is explicitly rescheduled/cancelled and the reference is cleared or retained under policy. CalendarEntry may exist without Cleaning, and one Cleaning can point to no more than one current entry. Do not introduce an overlap exclusion constraint until product defines overlap semantics.

Important query indexes should support authenticated ownership/participation lookups and stable list ranges, for example `(created_by_user_id, created_at, id)` for Orders, `(assigned_cleaner_user_id, status)` for work queues, `(owner_user_id, start_at, id)` for Calendar, `(order_id, created_at)` for Cleanings, and `(session_id, status)` for active sessions. Indexes must follow observed query patterns and preserve explicit ownership predicates.

### M4 compatibility mapping

| M4 field | Canonical persistence interpretation |
| --- | --- |
| `customerName`, `customerPhone` | Order-time customer contact snapshot in OrderTerms; keep even if a registered `customerUserId` is later linked. |
| `serviceDescription`, `serviceAddress` | OrderTerms service and address snapshots; not live Profile references. |
| `quotedPrice` | Versioned quote snapshot with amount/currency semantics preserved. It is not silently upgraded to agreed price, payment, revenue, or ledger fact. Exact legacy migration handling must be reviewed before import. |
| `notes` | OrderTerms snapshot/notes with a future privacy/retention policy; not copied into unrelated modules. |
| `calendarEntryId` | Initial Cleaning's nullable current schedule reference. The referenced CalendarEntry remains Calendar-owned. |

## 7. Data access and UnitOfWork

The approved persistence path is:

```text
Application
 → Repository Ports
 → Persistence Adapters
 → Drizzle
 → pg
 → PostgreSQL
```

Repository interfaces and UnitOfWork are application-facing ports. Persistence adapters map domain values to Drizzle queries and rows back to domain/result types. Drizzle schema types, SQL rows, driver errors, and transaction objects do not leak into Domain or Application. NestJS may compose the adapters but does not define business repositories or entities.

The UnitOfWork executes an application callback in one database transaction and provides a transaction-scoped context to every participating repository. All writes for one business command use the same transaction and connection. A repository must not silently open its own transaction or use a global pool connection inside a coordinated command. Infrastructure translates constraint/version failures into stable application errors. Nested independent transactions are not part of the contract.

## 8. Authentication and session architecture

The identity/session model is provider-independent. Firebase is the initial external identity proof adapter, not the permanent business API credential contract.

```text
Firebase credential
  → POST /v1/auth/bootstrap
  → verify with Firebase adapter
  → provider + subject resolves AuthIdentity → Qleanfeel User
  → create per-device Qleanfeel AuthSession
  → issue Qleanfeel access + refresh credentials
  → protected /v1/*
```

- **User:** internal Qleanfeel account and authorization subject; not a Firebase UID.
- **AuthIdentity:** unique provider and stable provider subject linked to a User. Account linking is a separately authorized/audited workflow; names/phone matches alone do not link accounts.
- **AuthSession:** one device/login lifecycle associated with a User, including active/revoked/expired state and server timestamps. Multiple devices have separate sessions.
- **Access token:** Qleanfeel-issued short-lived API credential presented as bearer authorization on native clients. It is verified by the Qleanfeel API, which creates the authenticated principal from trusted token/session claims and server-side state. Exact lifetime is deferred.
- **Refresh token:** high-entropy Qleanfeel credential used only at the refresh boundary; store token hashes, rotate on use, and associate each token with one session. Exact rotation-reuse response and lifetimes are deferred.
- **Logout:** revoke the current Qleanfeel session; logout-all semantics are deferred. Revocation must affect subsequent protected API requests according to the approved access-token/session validation design.

After bootstrap, `/v1/*` uses Qleanfeel credentials, not Firebase ID tokens. Provider adapters may later include another provider without changing business authorization. Never trust client-supplied userId, ownerId, creatorId, role/capability, origin, cleaner assignment, participant claims, or session status. `/me` is resolved only from the authenticated principal.

## 9. Authorization model

Every protected operation follows:

```text
authenticated principal
→ active account / capability checks
→ resource policy
→ ownership, assignment, or participation relationship
→ allowed state transition
→ operation
```

Authentication proves the caller's identity. Account capability expresses an enabled product capability. Resource ownership identifies who controls a resource. Assignment links a participant to work. Participation grants an explicit relationship-based permission. None is interchangeable with a global role label.

For `CreateManualOrder`, [ADR-021](ADR-021-canonical-order-creation-and-optional-scheduling.md) scopes authorization to any active authenticated Qleanfeel account creating for itself. The policy needs no existing resource relationship: `createdByUserId` and any initial Cleaning assignment come from `AuthenticatedPrincipal.userId`. This does not establish eligibility for future account types and does not add role or capability infrastructure.

| Resource | Initial policy |
| --- | --- |
| Profile | An active authenticated User may read/update their own Profile. Server resolves its owner from principal; request-supplied user IDs are ignored/rejected. |
| Order | Creator/owner may read and perform allowed Order commands. Assigned cleaner may read the work context and perform only policy-approved execution operations. A future registered customer participates through an explicit `customerUserId` relationship and gets separately defined read/cancel capabilities. Possession of an Order ID alone grants nothing. |
| Cleaning | Authorized creator/owner may read and schedule/cancel according to state policy. Assigned cleaner may read/start/complete/partially complete assigned work. Assignment is server-controlled. Future customer access is explicit and limited; customer cannot assert cleaner assignment or execution facts. |
| CalendarEntry | Owner or explicitly authorized participant may read and edit eligible Calendar facts. A standalone entry is controlled by Calendar ownership. Linked Cleaning schedule changes must pass through Schedule/Reschedule/CancelCleaning coordination. |

Future Client App access adds a verified customer relationship and operation-specific resource policy. It does not require rewriting cleaner policies into a global role enum. Denial may be `403`, or `404` when hiding resource existence is appropriate; each API policy must choose deliberately.

## 10. API boundary

Versioned HTTP DTOs are adapters around application commands/queries; they are not domain entities. Request schemas validate syntax and shape at the edge. Application/domain validation enforces business rules and state transitions. Responses expose authorized DTOs, not persistence rows.

Canonical API families:

```text
/v1/auth/*
/v1/me
/v1/me/profile
/v1/me/orders
/v1/me/cleanings
/v1/me/calendar/entries
/v1/me/dashboard
```

`/v1/me/manual-orders` is temporary compatibility only. It must map to the same canonical Order/Cleaning/Calendar command and store; it cannot become a second production aggregate. The old M4 client sends separate requests for Calendar then ManualOrder and uses compensation. That flow is not production-atomic and must migrate to the canonical `CreateManualOrder` endpoint/command before production use. Existing M1–M5 contracts remain unchanged until a separately approved client migration. M7-B.4 exposes only the production create route `POST /v1/me/orders`; it does not implement the full Orders API or Calendar CRUD/read/list endpoints.

The B4 request may carry optional `schedule.startAt` and `schedule.endAt` as client-requested appointment instants. The server authors generated IDs and metadata timestamps (`createdAt`, `updatedAt`, and event-recording times), origin, lifecycle state, version, creator, and assignment. Do not treat the scheduling interval as authority for whether work was performed.

Lists use bounded cursor pagination with stable ordering and explicit filters. Keep safe stable error envelopes and distinguish malformed input, unauthenticated (`401`), authenticated but denied (`403` or policy-selected `404`), missing resource, and state/version/idempotency conflict (`409`). Business commands expose intent-specific routes or operations; generic CRUD is limited to resources/fields where it cannot bypass lifecycle policy. Dashboard is read-only.

Browser session transport remains undecided: native bearer transport is the initial mobile direction, while browser cookie versus bearer handling requires approval before a future web client.

## 11. Transactions, idempotency, and concurrency

Business invariants are atomic at the backend, not repaired by client compensation. Under ADR-021, `CreateManualOrder` commits Order, initial OrderTerms, exactly one initial Cleaning, optional CalendarEntry, and the Cleaning-to-CalendarEntry relation together in one UnitOfWork/database transaction. Any failure rolls all of them back. Calendar does not open an independent transaction; nested UnitOfWork and best-effort compensation are not used.

The earlier general durable-idempotency requirement is explicitly deferred for `CreateManualOrder`. M7-B.4 adds no idempotency table, middleware, service, or reusable framework. A retry after a lost response can create a duplicate Order; track idempotency for a future API reliability slice, with no milestone number assigned. Other command retry policies remain subject to their own approved scope. Do not add an outbox table as a mandatory first implementation dependency; revisit it when reliable post-commit notifications or external effects are in scope.

Mutable Profile, Order, Cleaning, and CalendarEntry use integer `version` fields. A command provides the expected version (or an equivalent API `If-Match` representation); updates compare and increment atomically. A stale version returns `409`. `updatedAt` is descriptive metadata, not a concurrency token. Cross-resource commands check all changed resource versions in the same transaction.

## 12. Environment and operations

| Environment | Purpose and data boundary |
| --- | --- |
| Local | Developer-specific backend and PostgreSQL instance/database; disposable synthetic data and local-only credentials. |
| Test | Isolated PostgreSQL database/instance per test job or suite; deterministic synthetic fixtures; reset only within the test boundary. |
| Staging | Separate managed PostgreSQL and backend configuration; production-like migration and operational verification with non-production data/credentials. |
| Production | Separate managed PostgreSQL and backend environment; least-privilege runtime identity, controlled migration identity, monitored backups and restore procedures. |

No environment shares a database or credentials with another. Configuration includes non-secret environment-specific values such as API/database endpoint, pool limits, log level, and enabled provider names. Secret material includes DB passwords/identities where applicable, Firebase verifier credentials, token-signing or token-generation secrets, provider/API keys, and error-reporting credentials. Store and rotate secrets through an approved secret-management facility; never commit them, put them in the mobile bundle, or log them.

Migrations are ordered, reviewed, versioned, applied by the migration principal through a controlled deployment step, and tested against staging before production. Runtime starts only with a compatible schema. Define backup frequency/retention, point-in-time recovery where supported by the selected host, restore ownership, and periodic restore verification before production readiness. Do not claim a backup is valid without a tested restore path.

Operational baseline: structured logs with request/correlation ID and safe actor/resource references; redact access/refresh credentials, provider tokens, phone/contact data, and sensitive Order snapshots; never log secrets or full sensitive request bodies. Capture health/readiness, request/error/latency metrics, database pool/availability, migration status, and authentication/authorization failures. Error reporting must avoid leaking credentials or personal data. Hosting provider, concrete retention thresholds, and observability vendor remain undecided.

## 13. Mobile impact

Current client abstractions remain useful seams, but the following future integration changes are required; no M1–M5 code changes are authorized by this proposal.

| Current abstraction | Compatibility / eventual change |
| --- | --- |
| `AccessTokenProvider` | Keep as the opaque-token boundary used by `HttpTransport`; replace the development fixed token with a session-aware provider that returns a Qleanfeel access token and handles expiry/refresh without exposing token contents to domain code. |
| `AuthProviderAdapter` | Keep provider-specific phone/OTP behavior behind it. The Firebase adapter will produce a provider credential for bootstrap; it must not define the protected API credential. |
| `AuthSession` | Keep the provider-independent concept; eventually populate real server session ID/status/lifecycle or a safe client representation. Never store raw refresh-token material in domain state. |
| `AuthStateController` | Keep the application state boundary, but extend orchestration for bootstrap, Qleanfeel session restore/refresh, session-expired handling, and logout/revocation. |
| `AuthApi` | Keep as the authentication API port; evolve it to exchange provider proof at bootstrap and support Qleanfeel refresh, current identity, and logout/revocation. Exact response DTOs require the separate API implementation design. |
| `HttpTransport` | Keep provider/framework-independent. It must use the current Qleanfeel access credential, surface auth expiry safely, and coordinate refresh without retrying non-idempotent commands unsafely. |

Order, Cleaning, and Calendar mobile contracts will also need a coordinated move from M4's two-request `ManualOrder + CalendarEntry` create to one canonical production command. Existing development composition remains useful for unit/UI development but is not production persistence, authorization, or transaction behavior.

## 14. Explicit deferred decisions

The following are intentionally not fixed by M7 architecture:

1. Exact access-token and refresh-token lifetimes.
2. Refresh-token reuse detection response and recovery UX.
3. Logout-all devices semantics and user-facing device management.
4. Browser cookie versus bearer transport.
5. Calendar overlap/availability policy; M3 specifies UTC instants and half-open intervals only.
6. Outbox adoption timing; optional when reliable post-commit asynchronous effects become necessary.
7. Money/Ledger/accounting policy, agreed-price amendments, tax, payments, and financial effects of Cleaning completion.
8. External identity/provider selection beyond initial Firebase adapter.
9. Production hosting provider and concrete secret/observability services.
10. Legacy quote normalization/import policy and exact order terms revision/amendment behavior.
11. Detailed cancellation policy when an Order has multiple Cleanings in mixed states.

## 15. Implementation boundary

**M7 architecture has been approved.** M7-B.1–B.3 code and persistence are implemented on `main`. M7-B.4 is architecture/documentation only at this stage; production business code, business migrations, and endpoints await separate explicit implementation approval.
