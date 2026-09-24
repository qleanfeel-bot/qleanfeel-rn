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
| Jest (`npm test -- --ci`) | **IMPLEMENTED** | One test verifies that the root placeholder renders. No feature behavior is covered yet. |

## Android build verification

| Check | Status | Current coverage |
| --- | --- | --- |
| Debug APK (`./gradlew assembleDebug --no-daemon`) | **IMPLEMENTED** | Built locally and in CI; uploaded as `qleanfeel-android-debug-apk`. A debug APK may require Metro for JavaScript during development. |
| Release APK (`./gradlew assembleRelease --no-daemon`) | **IMPLEMENTED** | Built locally and in CI; uploaded as `qleanfeel-android-release-apk`. |

## Release artifact verification

| Check | Status | Current coverage |
| --- | --- | --- |
| Confirm release APK exists and contains `assets/index.android.bundle` | **PARTIAL** | The artifact has been manually verified. CI builds and uploads it but does not currently run a separate archive-content assertion. The release APK must run independently without Metro. |
| Verify production signing | **PLANNED** | Release currently uses the debug keystore; production signing belongs to future release preparation. |

## Real-device tests

| Check | Status | Current coverage |
| --- | --- | --- |
| Install, launch, and exercise on physical Android/iOS hardware | **PLANNED** | No automated or persistent real-device test setup is established. |
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

## Completion rule

A feature milestone is not complete just because code exists. Where applicable it needs implementation, tests, static validation, CI validation, required build verification, artifact verification, and documented known limitations. Hardware validation is required only when the feature depends on hardware.

## Remote-first development

The target loop is Phone (primary control/interface) → GitHub (source of truth) → GitHub Actions (reproducible CI/build environment) → APK artifact → Phone. Xubuntu is the persistent remote engineering workstation, and Codex supports development and verification automation. Physical devices are used for hardware validation when required. Local development is not forbidden; the project should remain operable and buildable remotely whenever practical.
