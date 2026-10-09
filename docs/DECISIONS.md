# Decision log

This log records accepted decisions, including approved future architecture. Approval of an architecture decision does not by itself authorize implementation.

## M6 ADRs — approved architecture

The following decisions were approved for the M6 architecture. Approval records future boundaries and does not authorize implementation:

- [ADR-014 — Canonical Order and Work Execution](ADR-014-canonical-order-and-work-execution.md): one Order model across origins; separate CalendarEntry and Cleaning facts.
- [ADR-015 — Money and Financial Boundaries](ADR-015-money-ledger-and-geography.md): exact integer Money representation and deferred accounting/tax decisions.
- [ADR-016 — Business Modules, APIs, Transactions, and Home Projection](ADR-016-business-modules-api-transactions-and-home.md): modular-monolith ownership, production consistency, API and Dashboard boundaries.
- [ADR-017 — Messaging, Evidence, Disputes, and Settlement Boundaries](ADR-017-messaging-evidence-and-settlement-boundaries.md): independent future domains and optional settlement rails.

Reference material: [M6 Architecture Proposal](M6_ARCHITECTURE_PROPOSAL.md) and [Domain/Data Dictionary](DOMAIN_DATA_DICTIONARY.md). These decisions do not retroactively alter M1–M5 implementation contracts.

## M7 — approved Production Backend Foundation

- [ADR-018 — Production Backend Foundation](ADR-018-production-backend-foundation.md): approved NestJS, PostgreSQL, Drizzle, provider-independent Qleanfeel sessions, authorization, and transaction boundaries.
- [ADR-019 — Identity and Authentication Foundation](ADR-019-identity-authentication-foundation.md): M7-B.2 identity, Firebase identity-proof verification, Qleanfeel sessions and credentials, refresh rotation, logout, and `/v1/me`.
- [ADR-020 — Authorization Foundation](ADR-020-authorization-foundation.md): framework-independent application policy boundary using a trusted principal and server-derived resource facts; no RBAC, capability persistence, or business resource implementation.
- [ADR-021 — Canonical Order Creation and Optional Scheduling](ADR-021-canonical-order-creation-and-optional-scheduling.md): M7-B.4 active-account authorization, one initial Cleaning, optional CalendarEntry, atomic UnitOfWork, and deferred idempotency.
- [ADR-022 — Order Retrieval Read Path](ADR-022-order-retrieval-read-path.md): M7-B.5 current-user collection/detail reads, ownership concealment, latest terms, and cursor pagination.
- [ADR-023 — Cleaning Execution Lifecycle](ADR-023-cleaning-execution-lifecycle.md): M7-B.6 execution transitions, ownership authorization, durable lifecycle history, and separation from acceptance/settlement.
- [ADR-024 — Cleaning Scheduling and Calendar Coordination](ADR-024-cleaning-scheduling-and-calendar-coordination.md): M7-B.8 Calendar ownership, schedule/reschedule transactions, version semantics, and execution-history separation.
- [M7 Architecture Proposal](M7_ARCHITECTURE_PROPOSAL.md): canonical approved module, command, persistence, API, security, operations, and mobile migration architecture.
- [Living Architecture Map](ARCHITECTURE_MAP.md): visual current/planned structure and data-flow guide; ADRs remain the decision source.

M7-B.1 through M7-B.8 are implemented and merged to `main`. ADR-018 through ADR-024 record the production backend foundation and the implemented M7 slices; the individual ADRs remain the decision sources for their scope. This status does not imply deployment or production readiness. ADR-018 records explicit M7 selections for choices that M6 deferred. It does not rewrite the M6 historical record or change existing M1–M5 mobile contracts. In particular, the Firebase bearer-token plan recorded under ADR-008 is historical and is superseded for the protected production API by Qleanfeel-issued session credentials after bootstrap.

## ADR-001 — React Native as the mobile application framework

- **Status:** Accepted
- **Decision:** Qleanfeel is being developed as a React Native mobile application for Android and iOS.
- **Context:** The project was initialized with React Native. The current mobile foundation includes an authentication UI/state flow, while real provider and backend integration remain planned.

## ADR-002 — Remote-first development workflow

- **Status:** Accepted
- **Decision:** Keep the project operable and buildable remotely whenever practical, using this artifact workflow:

  **Phone → GitHub → GitHub Actions → APK artifact → Phone**

- **Workstation:** The Xubuntu machine is the persistent remote engineering workstation for Codex, code editing, local validation, Gradle builds, logs, emulator/device debugging when available, Git operations, and repository maintenance.
- **Constraint:** Real hardware is not permanently connected to the workstation. Local development remains allowed.

## ADR-003 — Standalone Android release APK as a CI artifact

- **Status:** Accepted
- **Decision:** Build Android release APKs through GitHub Actions and upload them as a separate artifact. The release APK contains the React Native JavaScript bundle and does not require Metro at runtime.
- **Signing:** The current release build uses the debug keystore. This is suitable for development and CI verification only. Production signing is future work.

## ADR-004 — GitHub Actions as CI verification layer

- **Status:** Accepted
- **Decision:** Use GitHub Actions to run the checks and Android builds currently configured by the workflow.
- **Current CI coverage:** TypeScript (`npx tsc --noEmit`), ESLint (`npm run lint`), Jest (`npm test -- --ci`), Android debug build, Android release build, and upload of separate debug and release APK artifacts.
- **Scope:** This describes the existing workflow; it does not claim device, backend, integration, or production signing checks.

## ADR-005 — Firebase Authentication as the first authentication provider

- **Status:** Accepted (backend identity-proof verifier implemented; mobile provider adapter remains planned)
- **Decision:** Use Firebase as the initial external identity-proof provider. The backend verifier is implemented; the mobile app still uses its development authentication composition.

## ADR-006 — Separate provider identity from the Qleanfeel User

- **Status:** Accepted (domain model and backend identity resolution implemented; mobile provider integration remains planned)
- **Decision:** Qleanfeel has its own internal User ID. A Firebase UID is the provider subject, not the Qleanfeel User ID. AuthIdentity links an internal User to an external identity using `id`, `userId`, `provider`, `providerSubject`, `createdAt`, and `lastAuthenticatedAt`.

## ADR-007 — Keep authentication, authorization, and resource ownership distinct

- **Status:** Accepted (principal and application authorization boundary implemented; resource policies await business modules)
- **Decision:** Authentication establishes who the caller is; authorization determines permitted actions; resource ownership determines access to a particular resource. The Qleanfeel backend is authoritative. Client-provided `userId`, `role`, permissions, and ownership are not trusted. Roles are business/authorization state and may be multiple per User; they are not authentication identity.

## ADR-008 — Keep authentication provider-specific details behind boundaries

- **Status:** Accepted (mobile contracts and backend verifier/authentication adapters implemented; mobile production integration remains planned)
- **Decision:** Keep mobile Domain/Application behavior provider-agnostic, with provider SDK types and errors contained by adapters. The backend verifies Firebase proof behind its provider adapter and resolves it to a Qleanfeel User. Firebase proof is used at bootstrap; protected requests use Qleanfeel-issued credentials. Local token decoding does not establish validity.
- **Implemented backend endpoints:** `POST /v1/auth/bootstrap`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, and `GET /v1/me`. The current mobile app still uses an in-memory development authentication composition and is not connected to these endpoints.
- **Superseding M7 decision:** The Firebase bearer credential is retained as bootstrap identity proof only. Under approved [ADR-018](ADR-018-production-backend-foundation.md), protected `/v1/*` requests use Qleanfeel-issued access credentials after bootstrap. This note preserves the original M1 plan as history and does not change implementation.

## ADR-009 — Web3 is a future capability, not part of M1

- **Status:** Accepted (future capability)
- **Decision:** Keep a future wallet identity separate from AuthIdentity. A wallet is not automatically authentication. Any future reward issuance or optional blockchain settlement follows validated business events and is outside M1; no Web3 capability is currently implemented.

## ADR-010 — Separate authenticated API transport from domain and authentication state

- **Status:** Accepted (provider-independent mobile boundaries implemented; production provider/backend integration planned)
- **Decision:** Profile data access remains provider-independent through `ProfileRepository`. Concrete infrastructure communicates with the backend through HTTP/API boundaries. Authenticated API requests obtain an opaque access token through the application-level `AccessTokenProvider` port. Profile Domain/Application do not know HTTP, Firebase, bearer tokens, API URLs, or provider SDKs.
- **Identity rule:** The `userId` passed to `ProfileRepository` is a consistency expectation only; it is not authorization authority for `/v1/me/profile`. The backend resolves the caller from authenticated context. The client does not put that `userId` in the `/me` URL or request body. A mismatched returned identity is rejected as a safe infrastructure error.
- **Development:** The local composition exercises the same ProfileService → ProfileApiRepository → ProfileApi → HttpTransport chain using a development-only token provider and in-memory HTTP handler. It does not connect to a real backend or implement production authentication/token refresh.

## ADR-011 — Calendar / Scheduling Model, Semantics and API Contract

- **Status:** Accepted
- **File:** [docs/ADR-011-calendar.md](ADR-011-calendar.md)
- **Decision:** Calendar is independent from Order, uses absolute UTC timestamps and half-open intervals, and defines the current-user API under `/v1/me/calendar/entries`. The client does not send `userId`; the backend resolves identity and ownership from authenticated context and must be authoritative for production data. The current development implementation uses in-memory HTTP and is not production persistence.

## ADR-012 — ManualOrder and CalendarEntry Relationship

- **Status:** Accepted
- **File:** [docs/ADR-012-manual-orders.md](ADR-012-manual-orders.md)
- **Decision:** ManualOrder and CalendarEntry are separate domain entities. ManualOrder stores a `calendarEntryId` reference and order details; CalendarEntry alone owns scheduling timestamps and Calendar status. M4 creates CalendarEntry and then ManualOrder through an application use case, with development-level compensating Calendar deletion if ManualOrder creation fails. This is not a transaction. Production persistence and transactional backend orchestration remain deferred.

## ADR-013 — Cleaner Application Shell & Navigation

- **Status:** Accepted and implemented in M5
- **File:** [docs/ADR-013-navigation-application-shell.md](ADR-013-navigation-application-shell.md)
- **Decision:** Use React Navigation for the authenticated Home, Calendar, Orders, and Profile root surfaces, with separate Calendar and Orders stacks and one shared OrderDetails implementation. Keep AuthGate as the authentication boundary and keep domain state in the existing application/domain services. Calendar gestures own horizontal paging on the Calendar surface. The ADR also records the Android `react-native-screens` fragment factory and predictive-back compatibility setting.
