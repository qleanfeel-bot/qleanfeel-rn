# Test matrix

Statuses describe the current repository unless a row is explicitly marked as future work. Historical local/device results are labeled by milestone; configured CI checks and each run's pass/fail result are separate facts.

## Static checks

| Check | Status | Current coverage |
| --- | --- | --- |
| TypeScript (`npx tsc --noEmit`) | **PASSED — M5 RECORDED RESULT** | Passed for the M5 implementation and documentation closure. Current PR/CI results are reported by the applicable run. |
| ESLint (`npm run lint`) | **PASSED — M5 RECORDED RESULT** | Passed for the M5 implementation. Current PR/CI results are reported by the applicable run. |
| Documentation/code diff check (`git diff --check`) | **PASSED — M5 RECORDED RESULT** | Passed after M5 documentation closure; run again for each documentation change. |

## Unit tests

| Check | Status | Current coverage |
| --- | --- | --- |
| Jest (`npm test -- --ci`) | **M8-B.1 LOCAL RESULT — 34 suites / 303 tests** | Full suite passed on the M8-B.1 feature branch. Tests use fakes/in-memory handlers; no real Firebase/backend integration is covered. |

## Android build verification

| Check | Status | Current coverage |
| --- | --- | --- |
| Debug APK (`cd android && ./gradlew assembleDebug && cd ..`) | **PASSED** | M5 Android debug build passed. A debug APK may require Metro for JavaScript during development. |
| Release APK (`./gradlew assembleRelease --no-daemon`) | **IMPLEMENTED** | Built locally and in CI; uploaded as `qleanfeel-android-release-apk`. |

## Release artifact verification

| Check | Status | Current coverage |
| --- | --- | --- |
| Confirm release APK exists and contains `assets/index.android.bundle` | **PARTIAL** | The standalone bundle has been manually verified and the release APK was installed/tested on physical Android hardware. CI builds and uploads it but does not run a separate archive-content assertion. |
| Verify production signing | **PLANNED** | Release currently uses the debug keystore; production signing belongs to future release preparation. |

## Real-device tests

| Check | Status | Current coverage |
| --- | --- | --- |
| Install, launch, and exercise the M1 release APK on physical Android hardware | **IMPLEMENTED** | M1.9 physical-device verification completed successfully. The tested app used the in-memory development authentication composition, not Firebase/backend auth. |
| Exercise the M3 Calendar flow on a physical Android device | **IMPLEMENTED** | Login → Profile → Calendar → seed entry → create → edit → delete → Profile → logout was manually verified using the development in-memory composition. |
| Exercise the M4 Orders flow on a physical Android device | **PASSED in M5 smoke test** | Orders → Add Order → Save → Orders list → OrderDetails → Back, plus Orders Cancel, were verified by the user on Android. |
| Exercise the M5 application/navigation shell on a physical Android device | **PASSED** | The user verified the exact M5 flows listed below, including Calendar `external_order` creation and opening its linked OrderDetails. |
| Physical iOS device verification | **PLANNED** | No iOS device verification is recorded for M1. |
| Hardware-dependent behavior | **PLANNED** | BLE, camera, microphone, background behavior, and device-specific behavior require real Android hardware when those features are implemented. Add explicit device checks to the relevant milestone. |

Real hardware is not permanently connected to the Xubuntu workstation. The recorded physical-device flows used the development/in-memory composition and do not validate production backend integration or deployment. Hardware-dependent testing must be identified as such and must not block software-only milestones unless the feature requires hardware validation.

## M3 Android manual verification

The following flow was manually verified on a physical Android device:

1. Log in.
2. Enter OTP `000000`.
3. View Profile.
4. Open Calendar.
5. View the seeded Calendar entry.
6. Create an entry.
7. Edit the entry.
8. Delete the entry.
9. Switch back to Profile.
10. Log out.

The Profile/Calendar controls were checked after fixing the status-bar overlap. Calendar CRUD and logout were verified on the physical device. Calendar error/retry UI is covered by automated tests where applicable; deterministic manual failure injection was not established in M3. No production backend integration was tested.

## M4 Automated Coverage

ManualOrder domain validation, API request restrictions, DTO mapping, safe repository errors, in-memory handler CRUD reads, explicit HTTP routing, development composition, Calendar read-by-id, and scheduled creation compensation are covered by Jest tests. The authenticated UI tests cover Orders loading/empty/error/retry, validation, duplicate-submit blocking, create/list/details, linked Calendar scheduling, Profile/Calendar surface regressions, and logout. This is development composition coverage, not production backend or physical-device testing.

## M5 Application and Navigation Coverage

Automated tests cover authenticated landing on Home, root surface controls and tab navigation, Home and Calendar presentation, week/date selection, Calendar entry-to-ManualOrder mapping, the shared OrderDetails screen from Calendar and Orders, Orders create/cancel/list/details behavior, Profile integration, and Calendar/Orders nested navigation. These tests validate component and navigation behavior; gesture recognition and Android system-back behavior also require physical-device verification.

The user reports that the following physical Android smoke flows passed. No additional device results are implied:

1. Login → Home.
2. Bottom navigation Home → Calendar → Orders → Profile.
3. Root swipe on Home, Orders, and Profile.
4. Calendar week swipe changes week without switching the root surface.
5. Calendar → DaySummary → Back.
6. Calendar → OrderDetails → Back.
7. Orders → Add Order → Save → Orders list → OrderDetails → Back.
8. Orders Cancel.
9. Profile edit.
10. Logout.
11. Calendar `external_order` creation.
12. The created `external_order` opens through OrderDetails.

## M7 Backend Foundation — B.1–B.8 COMPLETE / MERGED

M7-B.1 through M7-B.8 are implemented and merged to `main`. This records repository implementation and test coverage, not deployment or production readiness. The backend unit/application/HTTP suite uses `node:test` through `tsx --test`; PostgreSQL integration tests are in `backend/test/postgres/` and require `TEST_DATABASE_URL` pointing to PostgreSQL 18. The [CI workflow](../.github/workflows/ci.yml) runs on pull requests to `main` and pushes to `main`. It installs Node 24 for backend checks, then runs format, lint, typecheck, unit tests, migrations, PostgreSQL integration tests, schema checks, and build. A separate Android job installs Node 22 and runs root TypeScript, ESLint, Jest, Android debug/release builds, and APK artifact uploads.

The rows below describe coverage present in the repository and checks configured in CI; they do not themselves record a local test run or assert the result of a particular GitHub Actions run. CI results belong to the corresponding Actions run. PostgreSQL integration coverage is not substituted with mocks when a local test database is unavailable.

| Test category | Status | Current coverage |
| --- | --- | --- |
| Backend identity and authentication unit/HTTP tests | **IMPLEMENTED** | `backend/test/identity.test.ts` and `backend/test/http.test.ts`; bootstrap, refresh, logout, access authentication, `/v1/me`, and error behavior. |
| Authorization boundary unit tests | **IMPLEMENTED** | `backend/test/authorization.test.ts`; framework-independent policy boundary and `backend/test/order-reads.test.ts` owner policy/use-case behavior. |
| PostgreSQL authentication and UnitOfWork integration tests | **IMPLEMENTED** | `backend/test/postgres/authentication.test.ts`, `unit-of-work.test.ts`, and `readiness.test.ts`; execution requires configured PostgreSQL 18. |
| M7-B.4 CreateManualOrder tests | **IMPLEMENTED — MERGED** | `backend/test/orders.test.ts` and `backend/test/postgres/orders.test.ts` cover canonical graph creation and full rollback after Calendar persistence failure. |
| M7-B.5 Order Retrieval tests | **IMPLEMENTED — MERGED** | `backend/test/order-reads.test.ts` covers owner-scoped application use cases, empty results, cursor continuation input, limit validation, current terms, multiple Cleanings, and optional CalendarEntry. `backend/test/postgres/orders.test.ts` covers authenticated list/detail, 401/404 concealment, owner isolation, latest terms, multiple Cleanings, optional CalendarEntry, deterministic tie-break ordering, cursor pages, invalid query and empty collection. |
| M7-B.6 Cleaning lifecycle tests | **COVERAGE PRESENT — MERGED** | `backend/test/cleaning-lifecycle-domain.test.ts` covers valid transitions, terminal-state rejection, timestamps, and versions. `backend/test/cleaning-lifecycle.test.ts` covers commands, ownership, missing/non-owned resources, invalid transitions, version conflicts, and event creation. `backend/test/postgres/orders.test.ts` covers authenticated HTTP behavior, persisted state/events, rollback, and concurrent starts. PostgreSQL execution is configured in CI against PostgreSQL 18. |
| M7-B.7 Cleaning retrieval/history tests | **COVERAGE PRESENT — MERGED** | `backend/test/cleaning-reads.test.ts` covers owner policy, canonical current Cleaning state, concealed missing/non-owned resources, and separate lifecycle-history reads. PostgreSQL HTTP coverage is in `backend/test/postgres/orders.test.ts`; it verifies persisted lifecycle history and owner-scoped retrieval. |
| M7-B.8 Cleaning scheduling tests | **COVERAGE PRESENT — MERGED** | `backend/test/cleaning-scheduling.test.ts` covers ScheduleCleaning and RescheduleCleaning use cases, ownership, state/version conflicts, intervals, and version/identity semantics. `backend/test/postgres/orders.test.ts` covers both HTTP routes, persisted relation and versions, ownership, atomic rollback, concurrent reschedule/reschedule, and schedule/reschedule versus StartCleaning. These PostgreSQL tests run through the configured CI database job. |
| M7-B.8 local verification record | **PASSED — PRE-MERGE LOCAL RUN** | On implementation commit `8a7dfce`, backend format, lint, typecheck, build, schema check, and unit/HTTP suite passed (58 tests); root TypeScript, ESLint, Jest (30 suites / 276 tests), and Android debug/release builds passed. PostgreSQL integration tests were not run locally because `TEST_DATABASE_URL` was unavailable. |
| Backend CI checks | **CONFIGURED IN CI** | `.github/workflows/ci.yml` runs backend `format:check`, `lint`, `typecheck`, `test`, `db:migrate`, `test:postgres`, `db:check`, and `build` with a PostgreSQL 18 service. Check outcomes are reported per Actions run. |
| Android/RN CI checks | **CONFIGURED IN CI** | `.github/workflows/ci.yml` runs `npx tsc --noEmit`, `npm run lint`, `npm test -- --ci`, Android `assembleDebug` and `assembleRelease`, and uploads both APKs. These checks do not exercise production backend integration. |
| M7-B.8 merge CI run | **PASSED — BEFORE MERGE** | [GitHub Actions run 37816678697](https://github.com/qleanfeel-bot/qleanfeel-rn/actions/runs/37816678697) passed for source commit `8a7dfce`; backend and Android jobs were both successful. This is CI evidence, separate from the local results above. |

## M6 Architecture — APPROVED, DESIGN ONLY

The M6 architecture and Domain/Data Dictionary are design artifacts, not an M6 software implementation. M7-B.1 through M7-B.8 are merged; the M7 slices implement the selected backend/auth foundation, canonical Order creation and retrieval, Cleaning lifecycle and reads, and Cleaning scheduling coordination. WorkAcceptance, settlement, and Web3 remain separate future concepts. Later Money, tax, Dashboard, Messaging, Evidence, and settlement behavior requires tests if corresponding implementation is approved.

## M8 — Mobile ↔ Backend Integration — APPROVED / SESSION FOUNDATION UNDER REVIEW

| Check | Status | Current coverage |
| --- | --- | --- |
| Session lifecycle, secure-token adapter, refresh rotation/failure, logout, and HTTP single-flight/retry tests | **LOCAL PASSED — M8-B.1 FEATURE BRANCH; PR CI PENDING** | `SessionManager.test.ts`, `HttpSessionApi.test.ts`, `KeychainSecureTokenStore.test.ts`, and `HttpTransport.test.ts` cover the provider-independent implementation with fakes. This is not real Firebase or backend integration. |
| Full mobile Jest suite and TypeScript typecheck after M8-B.1 | **LOCAL PASSED — 34 suites / 303 tests; `npx tsc --noEmit` passed** | Executed on the M8-B.1 feature branch. GitHub CI remains a separate pending result until the Draft PR workflow completes. |
| M8-B.1 lint, formatting, and whitespace checks | **LOCAL PASSED** | `npm run lint`, Prettier check of changed TypeScript/TSX files, and `git diff --check` passed. Android Gradle build was not run locally because only 4.3 GB disk space was available; the PR CI workflow builds debug and release APKs. |
| Firebase phone sign-in, configured production session composition, and real API environment | **NOT IMPLEMENTED — PREREQUISITES OPEN** | No mobile Firebase adapter/configuration or production base URL is added by M8-B.1; app remains on development composition. |
| Canonical Orders DTO mapping, repository, and UI states | **PLANNED — M8-C** | The backend `GET /v1/me/orders` route and PostgreSQL read path exist. The mobile app is not wired to that route and its development ManualOrder contract is not the canonical Orders contract. |
| Real Android → HTTP → NestJS → PostgreSQL → Android acceptance | **PLANNED — REQUIRED BY M8-D** | Not currently covered by mobile Jest, backend HTTP tests, or backend PostgreSQL integration tests individually. Acceptance must use real HTTP and PostgreSQL-backed behavior, verify owner isolation, and avoid `createDevelopmentHttpFetch`. |
| Isolated Firebase/PostgreSQL test environment and Android connectivity | **OPEN PREREQUISITE** | Repository Compose/CI config provides PostgreSQL test infrastructure, but no configured Firebase project, shared HTTPS endpoint, VPS, DNS, firewall, or deployed backend is established by this test matrix. Verify prerequisites before device acceptance. |

These are future acceptance requirements, not test results. Existing backend PostgreSQL integration and Android/RN CI checks remain separate layers; neither alone proves the complete mobile-to-database path. The accepted first slice is online-only and must cover loading, success, empty, network failure, server failure, expired/revoked session, and safe error display.

## Future BLE tests

| Check | Status | Current coverage |
| --- | --- | --- |
| BLE permission, discovery, connection, and device interaction tests | **PLANNED** | No BLE implementation exists. These tests require compatible physical hardware and should be introduced only if a feature requires BLE. |

## M1 authentication tests

The mobile auth foundation and its boundary-level tests are implemented. These tests use mocked ports or the development composition and do not establish real-provider or real-backend behavior.

| Test category | Status | Current / planned verification |
| --- | --- | --- |
| AuthStateController state, OTP orchestration, restoration, logout, error mapping, subscriptions, stale-operation and credential-isolation behavior | **IMPLEMENTED** | `src/application/auth/__tests__/AuthStateController.test.ts` (18 tests) exercises the application boundary using fake provider/API ports. |
| Login UI phone/code flow, progress, safe errors, retry, subscription lifecycle, credential non-disclosure | **IMPLEMENTED** | `src/presentation/auth/__tests__/LoginScreen.test.tsx` (10 tests) exercises LoginScreen with a fake AuthStateController boundary. |
| AuthGate state mapping, restoration trigger, subscription lifecycle, stale/unmounted behavior, form preservation, authenticated card and logout | **IMPLEMENTED** | `src/presentation/auth/__tests__/AuthGate.test.tsx` (12 tests) exercises gate behavior using fake ports. |
| App composition and development OTP preview flow | **IMPLEMENTED** | `__tests__/App.test.tsx` (4 tests) verifies root integration and the in-memory development composition; this is not a production provider. |
| HTTP transport status, JSON, authorization, and network behavior | **IMPLEMENTED** | `src/infrastructure/http/__tests__/HttpTransport.test.ts` covers GET/PATCH JSON, bearer attachment, blocking protected requests without a token, safe 400/401/403/404/500 mapping, bounded refresh/retry, and network failure. |
| Profile API/repository contract and mapping | **IMPLEMENTED** | `src/infrastructure/profile/__tests__/ProfileApiRepository.test.ts` verifies `/v1/me/profile`, PATCH body, DTO mapping, 404-to-null, safe status errors, and requested identity consistency. |
| Development access-token and service-to-transport chain | **IMPLEMENTED** | `src/infrastructure/auth/__tests__/DevelopmentAccessTokenProvider.test.ts` and `src/development/__tests__/createDevelopmentComposition.test.ts` verify bearer-header use and profile read/update without a backend. |
| Mobile Firebase login, credential transfer, and session restoration | **PLANNED — M8-B REMAINS INCOMPLETE** | M8-B.1 implements provider-independent Qleanfeel session handling; the mobile Firebase adapter and production composition are not implemented. |
| Real authentication restoration and provider sign-out | **PLANNED** | Controller behavior with fake ports is tested; restoration/logout against a real provider remains unverified. |
| Backend 401/403 handling, user provisioning/bootstrap, and current-user retrieval | **IMPLEMENTED** | Backend tests cover Qleanfeel bootstrap/session authentication and `/v1/me`; mobile `HttpTransport` remains connected to a development handler. |
| Application authorization boundary | **IMPLEMENTED** | M7-B.3 provides the framework-independent policy boundary; M7-B.5 and B.6 use pure ownership policies over already loaded resource facts. Future assignment/participation policies remain out of scope. |
| M1.7 final test coverage | **IMPLEMENTED** | At M1 completion, 44 Jest tests passed across the four suites then present. The current full repository suite is 34 suites / 303 tests after M8-B.1. Coverage uses fakes and does not claim real provider/backend integration. |
| M1.8 CI verification | **IMPLEMENTED** | CI is green for TypeScript, ESLint, Jest, Android debug/release builds, and debug/release APK artifacts. |
| M1.9 release APK + physical-device verification | **IMPLEMENTED** | Release APK was installed and tested successfully on physical Android hardware using the development auth composition. This does not verify Firebase/backend auth or production signing. |

## Completion rule

A feature milestone is not complete just because code exists. Where applicable it needs implementation, tests, static validation, CI validation, required build verification, artifact verification, and documented known limitations. Hardware validation is required only when the feature depends on hardware.

## Remote-first development

The target loop is Phone (primary control/interface) → GitHub (source of truth) → GitHub Actions (reproducible CI/build environment) → APK artifact → Phone. Xubuntu is the persistent remote engineering workstation, and Codex supports development and verification automation. Physical devices are used for hardware validation when required. Local development is not forbidden; the project should remain operable and buildable remotely whenever practical.
