# Test matrix

Statuses describe the current repository unless a row is explicitly marked as future work.

## Static checks

| Check | Status | Current coverage |
| --- | --- | --- |
| TypeScript (`npx tsc --noEmit`) | **IMPLEMENTED** | Run locally and in GitHub Actions. |
| ESLint (`npm run lint`) | **IMPLEMENTED** | Run locally and in GitHub Actions. |

## Unit tests

| Check | Status | Current coverage |
| --- | --- | --- |
| Jest (`npm test -- --ci`) | **IMPLEMENTED** | 44 passing tests across the auth controller, LoginScreen, AuthGate, and App composition suites listed below. Tests use fakes; no real Firebase/backend integration is covered. |

## Android build verification

| Check | Status | Current coverage |
| --- | --- | --- |
| Debug APK (`./gradlew assembleDebug --no-daemon`) | **IMPLEMENTED** | Built locally and in CI; uploaded as `qleanfeel-android-debug-apk`. A debug APK may require Metro for JavaScript during development. |
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
| Physical iOS device verification | **PLANNED** | No iOS device verification is recorded for M1. |
| Hardware-dependent behavior | **PLANNED** | BLE, camera, microphone, background behavior, and device-specific behavior require real Android hardware when those features are implemented. Add explicit device checks to the relevant milestone. |

Real hardware is not permanently connected to the Xubuntu workstation. Hardware-dependent testing must be identified as such and must not block software-only milestones unless the feature requires hardware validation.

## Future integration tests

| Check | Status | Current coverage |
| --- | --- | --- |
| API/backend, authentication, persistence, and cross-feature integration tests | **PLANNED** | No backend or corresponding integration-test harness currently exists. Define tests alongside the relevant feature milestones. |

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
| Real provider OTP success/failure, invalid/expired credential behavior, and provider credential expiration | **PLANNED** | No Firebase or other concrete provider adapter is integrated; boundary fakes do not verify provider behavior. |
| Real authentication restoration and provider sign-out | **PLANNED** | Controller behavior with fake ports is tested; restoration/logout against a real provider remains unverified. |
| Backend 401/403 handling, user provisioning/bootstrap, and current-user retrieval | **PLANNED** | `POST /v1/auth/bootstrap` and `GET /v1/me` remain planned contracts; no backend or HTTP client exists. |
| Server authorization and resource ownership | **PLANNED** | No backend authorization or resource ownership implementation exists to test. |
| M1.7 final test coverage | **IMPLEMENTED** | 44 Jest tests pass across the four suites above. Coverage uses fakes and does not claim real provider/backend integration. |
| M1.8 CI verification | **IMPLEMENTED** | CI is green for TypeScript, ESLint, Jest, Android debug/release builds, and debug/release APK artifacts. |
| M1.9 release APK + physical-device verification | **IMPLEMENTED** | Release APK was installed and tested successfully on physical Android hardware using the development auth composition. This does not verify Firebase/backend auth or production signing. |

## Completion rule

A feature milestone is not complete just because code exists. Where applicable it needs implementation, tests, static validation, CI validation, required build verification, artifact verification, and documented known limitations. Hardware validation is required only when the feature depends on hardware.

## Remote-first development

The target loop is Phone (primary control/interface) → GitHub (source of truth) → GitHub Actions (reproducible CI/build environment) → APK artifact → Phone. Xubuntu is the persistent remote engineering workstation, and Codex supports development and verification automation. Physical devices are used for hardware validation when required. Local development is not forbidden; the project should remain operable and buildable remotely whenever practical.
