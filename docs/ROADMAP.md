# Qleanfeel roadmap

This roadmap separates the implemented foundation from planned product work. A planned milestone does not imply that its features exist.

## Milestones

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 — Foundation | React Native project initialized; Android/iOS identifiers normalized; basic project validation; debug build; CI; standalone Android release build | **COMPLETE** |
| M0.5 — Project Governance | Project documentation; architecture rules; decision log; test matrix; remote-first development workflow | **COMPLETE** |
| M1 — Authentication | Provider-independent mobile authentication foundation, tests, CI, and release/device verification | **COMPLETE** |
| M2 — User/Profile | User profile, display-name editing, and client-side API boundaries | **COMPLETE** |
| M3 — Calendar | Calendar and scheduling workflows using the development in-memory HTTP composition | **COMPLETE** |
| M4 — Manual Orders | Manual order create/list/details flow, linked Calendar scheduling, and development HTTP composition | **COMPLETE** |
| M5 — Cleaner Application Shell & Navigation | Authenticated Home, Calendar, Orders, and Profile root surfaces with nested Calendar/Orders navigation | **COMPLETE** |
| M6 — Backend & Business Architecture Definition | Canonical business model and future backend/API boundaries; architecture only | **ARCHITECTURE APPROVED — IMPLEMENTATION DEFERRED** |
| M7 — Production Backend Foundation | Production modular-monolith architecture, persistence/auth boundaries, canonical commands, and implementation plan | **M7-B.1–B.6 COMPLETE — MERGED; M7-B.7 IMPLEMENTED IN DRAFT PR — NOT MERGED** |
| M8 — Reports | Reporting workflows | **PLANNED** |
| M9 — Notifications | Notification workflows | **PLANNED** |
| M10 — Client/Marketplace foundations | Initial client and marketplace foundations | **PLANNED** |
| M11 — Security hardening | Security review and hardening | **PLANNED** |
| M12 — Production release preparation | Production readiness and release preparation | **PLANNED** |

M1 is complete as a provider-independent mobile authentication foundation with tests, CI, and release APK verification on a physical Android device. The mobile app still uses an in-memory development composition; it is not connected to the production backend or a mobile Firebase adapter. M7-B.2 backend authentication and Firebase identity-proof verification are implemented separately. Production mobile credential integration and signing remain future work. M6 remains architecture-only; selected backend foundations were implemented under M7-B. The previous Emergency placeholder is deferred without a milestone number; no later milestone number is reassigned here. M8–M12 remain planned and are not claims of existing functionality or settled implementation details.

M2.1–M2.5 are complete: Profile domain, UI/editing flow, API contract, provider-independent HTTP/API infrastructure, access-token port, safe error mapping, and local development composition are implemented. No real backend integration is claimed.

### M1 — Authentication decomposition

M1.0 through M1.9 are complete. The completed release/device verification used the current development authentication composition; it does not validate real Firebase or backend authentication.

| Sub-milestone | Scope | Status |
| --- | --- | --- |
| M1.0 — Authentication Architecture | Agree and document provider identity, internal User, authorization boundaries, and the planned backend contract | **COMPLETE** |
| M1.1 — Auth Domain | Define provider-independent User, AuthIdentity, AuthSession, auth errors, and repository contract | **COMPLETE** |
| M1.2 — Auth Provider/API boundary | Define provider and planned backend API ports; no concrete provider or HTTP implementation | **COMPLETE** |
| M1.3 — Secure token/session boundary | Keep opaque provider credentials outside Domain state; no credential persistence or custom Qleanfeel token/session implementation | **COMPLETE** |
| M1.4 — Auth state | Implement the provider-independent AuthStateController and state lifecycle | **COMPLETE** |
| M1.4.1 — Auth state subscriptions | Add observable state subscriptions and safe unsubscription | **COMPLETE** |
| M1.5 — Login UI | Implement provider-independent phone/OTP UI against AuthStateController | **COMPLETE** |
| M1.5.1 — Login UI integration | Render Login UI from App using an isolated in-memory development composition | **COMPLETE** |
| M1.6 — AuthGate | Select loading, login, or authenticated user-card surface from AuthStateController state | **COMPLETE** |
| M1.7 — Tests / final M1 test coverage | Complete the provider-independent auth/controller/UI tests (44 Jest tests); real provider/backend integration remains outside M1 | **COMPLETE** |
| M1.8 — CI verification | Verify TypeScript, ESLint, Jest, Android debug/release builds, and APK artifacts in green CI | **COMPLETE** |
| M1.9 — Release APK + physical-device verification | Build/install/test the release APK on physical Android hardware using the current development auth composition | **COMPLETE** |

### M2 — User/Profile decomposition

| Sub-milestone | Scope | Status |
| --- | --- | --- |
| M2.1 — Profile Domain/Application | Provider-independent Profile, repository contract, and ProfileService | **COMPLETE** |
| M2.2 — Profile UI | Authenticated profile view and safe states | **COMPLETE** |
| M2.3 — Profile editing | Edit display name through ProfileService | **COMPLETE** |
| M2.4 — Backend API contract | Define current-user GET/PATCH contract and safe error categories | **COMPLETE** |
| M2.5 — Profile HTTP/API boundaries and development composition | HTTP/API/repository infrastructure, AccessTokenProvider port, development composition, and tests; live backend/provider remain future work | **COMPLETE** |

### M3 — Calendar / Scheduling decomposition

| Sub-milestone | Scope | Status |
| --- | --- | --- |
| M3.0 — Calendar architecture/API contract | Calendar model, time semantics, boundaries, and API contract recorded in ADR-011 | **COMPLETE** |
| M3.1 — Calendar domain | CalendarEntry model, validation, and repository contract | **COMPLETE** |
| M3.2 — Repository/application service | CalendarApiRepository boundary and CalendarService operations | **COMPLETE** |
| M3.3 — HTTP/API infrastructure | CalendarApi and shared HttpTransport integration | **COMPLETE** |
| M3.4 — Development HTTP composition | In-memory development HTTP handler and application composition | **COMPLETE** |
| M3.5 — Calendar UI and authenticated shell | Calendar CRUD UI and local Profile/Calendar shell controls | **COMPLETE** |
| M3.5d/e — Android verification and UI polish | Physical-device flow verification and status-bar overlap/UI adjustments | **COMPLETE** |

M3 uses a development in-memory HTTP implementation. It verifies the mobile API boundary and UI flow but does not provide production backend persistence. Production backend integration is a separate engineering concern; its exact scope and milestone number will be determined by a separate architecture decision. This does not change the existing M4 name or the numbering of future milestones.

### M4 — Manual Orders decomposition

| Sub-milestone | Scope | Status |
| --- | --- | --- |
| M4.0 — ManualOrder / CalendarEntry relationship | Separate domain entities, one-way `calendarEntryId` reference, and scheduling ownership recorded in ADR-012 | **COMPLETE** |
| M4.1 — ManualOrder domain and application | Validated ManualOrder entity, repository/service contracts, and scheduled creation coordinator | **COMPLETE** |
| M4.2 — HTTP/API and development composition | Authenticated collection/create/item API boundaries and in-memory development handler | **COMPLETE** |
| M4.3 — Calendar read-by-id | Add `GET /v1/me/calendar/entries/{entryId}` without changing Calendar semantics | **COMPLETE** |
| M4.4 — Orders UI | Authenticated Orders surface, create form, list, and details | **COMPLETE** |
| M4.5 — Verification | Domain/API/handler/orchestration/UI tests, static checks, and Android debug build | **COMPLETE** |

M4 uses a development in-memory HTTP implementation only. `ManualOrder` stores a `calendarEntryId`; `CalendarEntry` owns `startAt`, `endAt`, and Calendar status. The application creates CalendarEntry first and compensates with Calendar delete if ManualOrder creation fails. This is client/application-level compensation, not a transaction. Production persistence and transactional backend orchestration remain future work.

### M5 — Cleaner Application Shell & Navigation

M5 is complete. `AuthGate` remains the authentication boundary and renders an authenticated shell backed by React Navigation. The four root surfaces are Home, Calendar, Orders, and Profile. Calendar and Orders have their own stacks, and both navigate to the shared OrderDetails implementation. The shell preserves M2-M4 domain ownership and behavior; Calendar `external_order` creation uses the existing scheduled-order application service. Navigation, gestures, Android setup, and scope are recorded in [ADR-013](ADR-013-navigation-application-shell.md).

M5 passed its automated application/navigation tests and the physical Android smoke flows listed in [TEST_MATRIX.md](TEST_MATRIX.md). No production backend or new domain model was introduced.

### M6 — Backend & Business Architecture Definition (APPROVED ARCHITECTURE)

M6 defines the canonical Order, execution, financial, geography, backend-module, API, transaction, and Home projection boundaries. The approved architecture and data dictionary are [M6_ARCHITECTURE_PROPOSAL.md](M6_ARCHITECTURE_PROPOSAL.md) and [DOMAIN_DATA_DICTIONARY.md](DOMAIN_DATA_DICTIONARY.md); decisions are recorded in [DECISIONS.md](DECISIONS.md). M6 itself remains architecture-only. Later M7 milestones implement selected backend foundations; Orders/Cleaning/Calendar business persistence remains outside M6.

### Future user experience direction (outside M5)

A later product decision may reorganize the root information architecture as **HOME | MONEY | PROFILE**, place a seven-day Calendar on Home, and present the monthly Calendar as an overlay. This is a future direction only; it is not M5 scope or an M5 acceptance criterion. Finance and related capabilities remain future work.

### M7 — Production Backend Foundation

M7 selected NestJS, PostgreSQL, Drizzle, provider-independent Qleanfeel sessions, and application-level authorization boundaries. M7-B.1 through M7-B.6 are merged to `main`; M7-B.7 is implemented on its Draft PR branch. The current implementation state is summarized in [ARCHITECTURE_MAP.md](ARCHITECTURE_MAP.md); decisions remain in [ADR-018](ADR-018-production-backend-foundation.md) through [ADR-023](ADR-023-cleaning-execution-lifecycle.md).

### M7-B.4 — Canonical Order + Initial Cleaning + Optional Calendar Scheduling

Architecture is approved in [ADR-021](ADR-021-canonical-order-creation-and-optional-scheduling.md). M7-B.4 is merged to `main`; it provides `POST /v1/me/orders`, one initial Cleaning per successful `CreateManualOrder`, optional Calendar scheduling, and one atomic UnitOfWork. This slice has no generic API idempotency; that work is explicitly deferred to a future API reliability slice without an assigned milestone number. M7 is not a Finance milestone; Money/Accounting and tax policy remain deferred future work.

| M7-B slice | Scope | Status |
| --- | --- | --- |
| M7-B.1 — Production Backend Foundation | NestJS composition, PostgreSQL/Drizzle persistence boundary, and UnitOfWork | **COMPLETE — MERGED** |
| M7-B.2 — Identity + Authentication Foundation | Firebase identity proof, Qleanfeel sessions/credentials, and protected identity endpoints | **COMPLETE — MERGED** |
| M7-B.3 — Authorization Foundation | Framework-independent Application authorization boundary | **COMPLETE — MERGED** |
| M7-B.4 — Canonical Order + Initial Cleaning + Optional Calendar Scheduling | ADR-021 production command, persistence, guarded endpoint, and transaction tests | **COMPLETE — MERGED** |
| M7-B.5 — Order Retrieval / Orders Read Path | Authenticated owner-scoped collection/detail reads, current terms, Cleanings, optional CalendarEntry, cursor pagination | **COMPLETE — MERGED** |
| M7-B.6 — Cleaning Execution Lifecycle | Explicit owner-authorized execution commands, timestamps, versioned transitions, durable lifecycle history | **COMPLETE — MERGED** |
| M7-B.7 — Cleaning Retrieval & Lifecycle History | Owner-authorized current Cleaning reads and separate immutable lifecycle history reads | **IMPLEMENTED — DRAFT PR; NOT MERGED** |

## Remote-first development

The project is optimized to remain operable and buildable remotely where practical:

**Phone** = primary control/interface → **GitHub** = source of truth → **GitHub Actions** = reproducible CI/build environment → **Xubuntu** = persistent remote engineering workstation → **Codex** = development/verification automation → **physical devices** = hardware validation when required.

The intended artifact loop is **Phone → GitHub → GitHub Actions → APK artifact → Phone**. Local development is also supported; remote-first does not forbid it.

The Xubuntu workstation is used for Codex, code editing, local validation, Gradle builds, logs, emulator/device debugging when available, Git operations, and repository maintenance. Real hardware is not permanently connected to it.

## Milestone completion rule

A feature milestone is not complete merely because its code exists. Where applicable, completion includes:

- implementation;
- tests and static validation;
- CI validation;
- required build and artifact verification;
- documented known limitations.

Hardware validation is required only for features that depend on hardware. Hardware-dependent tests must be identified explicitly and do not block software-only milestones unless that milestone requires the hardware behavior.
