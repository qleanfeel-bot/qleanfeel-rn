# Decision log

This log records accepted decisions only. Proposed architecture principles are documented in [ARCHITECTURE.md](ARCHITECTURE.md), not treated as additional accepted implementation decisions here.

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

- **Status:** Accepted (provider integration planned)
- **Decision:** Use Firebase Authentication as the first planned external authentication provider. Firebase is not yet integrated.

## ADR-006 — Separate provider identity from the Qleanfeel User

- **Status:** Accepted (domain model implemented; Firebase integration planned)
- **Decision:** Qleanfeel has its own internal User ID. A Firebase UID is the provider subject, not the Qleanfeel User ID. The provider-independent User and AuthIdentity domain models are implemented; AuthIdentity links an internal User to an external identity using `id`, `userId`, `provider`, `providerSubject`, `createdAt`, and `lastAuthenticatedAt`.

## ADR-007 — Keep authentication, authorization, and resource ownership distinct

- **Status:** Accepted (backend authorization implementation planned)
- **Decision:** Authentication establishes who the caller is; authorization determines permitted actions; resource ownership determines access to a particular resource. The Qleanfeel backend is authoritative. Client-provided `userId`, `role`, permissions, and ownership are not trusted. Roles are business/authorization state and may be multiple per User; they are not authentication identity.

## ADR-008 — Keep authentication provider-specific details behind boundaries

- **Status:** Accepted (mobile contracts implemented; concrete adapters/backend planned)
- **Decision:** Keep mobile Domain/Application behavior provider-agnostic, with provider SDK types and errors contained by adapters. The mobile provider and API ports and application state boundary are implemented; concrete provider/backend implementations are not. The planned backend verifies credentials behind provider-specific verifier boundaries before resolving an external identity to a Qleanfeel User. The initial planned contract uses `Authorization: Bearer <Firebase ID token>` and requires server-side verification; local token decoding does not establish validity.
- **Planned endpoints:** `POST /v1/auth/bootstrap` for credential verification and identity/User resolution, and `GET /v1/me` for the current Qleanfeel User and authorization/business identity state. Neither endpoint currently exists.

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
