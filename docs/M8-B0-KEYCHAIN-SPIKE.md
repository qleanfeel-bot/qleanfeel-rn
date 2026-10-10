# M8-B.0 — Secure Storage Compatibility Spike

## Result

**Status: PASS WITH LIMITATIONS.** `react-native-keychain` 10.0.0 was added as the only direct dependency change. React Native CLI discovered its Android native module; unit tests, lint, typecheck, formatting, and PR CI passed. The CI Android APK build passed with the project's New Architecture configuration. On 2026-10-09, the development harness also passed native write/read/replace/delete and process-restart checks on one Android 13 (API 33) device. The result supports using Keychain for the M8-B secure-storage implementation on this tested configuration. It does not establish behavior across all Android versions/devices or uninstall/reinstall behavior, and the local Gradle build remains unverified because that attempt ran out of disk space.

## Configuration examined

The spike used the repository's React Native CLI Android project: React Native 0.87.1, React 19.2.3, Android New Architecture enabled, Kotlin 2.2.0, compile SDK 37, target SDK 36, min SDK 24, and application ID `com.qleanfeel.app`. The project uses npm and `package-lock.json`.

`react-native-keychain` 10.0.0 was selected because npm reported it as the current `latest` tag during the spike and its package metadata declares Node.js `>=16`, no runtime package dependencies, and a React Native Codegen module (`RNKeychainSpec`). Its Android Gradle configuration declares min SDK 23, below this app's min SDK 24. The package does not declare a peer dependency or published compatibility matrix for React Native 0.87.1. Its own package development metadata references React Native 0.77.1, which is not proof of incompatibility, but leaves an exact-version compatibility gap. Therefore an actual Android build and device check remain necessary.

## Isolated harness

`App.tsx` exposes a development-only control only on Android. It switches to `src/development/keychain/KeychainSpikeScreen.tsx`; the existing application remains the default and its auth/manual-order composition was not changed. The screen uses a dedicated service name and fixed synthetic values only. It offers write/read, replacement, delete, and a check operation intended for a relaunch check. It displays verification status only; stored values and native error details are neither displayed nor logged. The harness contains no Firebase, Qleanfeel token, Session Manager, or production authentication behavior.

The test in `src/development/keychain/__tests__/KeychainSpikeScreen.test.tsx` mocks the native module. It verifies the UI's operation wiring and safe status handling, not native encryption or persistence.

## Verification evidence

Commands and results from the initial spike checkout:

| Command                                                                                                | Result                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm view react-native-keychain@latest version peerDependencies dependencies engines dist-tags --json` | Reported latest `10.0.0`; Node engine `>=16`; no declared peer/runtime dependencies.                                                                                                                                                                 |
| `npm install --save-exact react-native-keychain@10.0.0`                                                | Passed. Only `package.json` and the matching `package-lock.json` entry changed; no transitive package was added. npm printed an aggregate audit count for the repository dependency tree; no audit remediation was in scope.                         |
| `./node_modules/.bin/react-native config`                                                              | Passed; Android config discovered `KeychainPackage` and `RNKeychainSpec` 10.0.0. This verifies CLI autolinking discovery, not a compiled native binary.                                                                                              |
| `npm test -- --runInBand src/development/keychain/__tests__/KeychainSpikeScreen.test.tsx`              | Passed: 1 suite, 2 tests.                                                                                                                                                                                                                            |
| `npx tsc --noEmit`                                                                                     | Passed.                                                                                                                                                                                                                                              |
| `npm run lint`                                                                                         | Passed.                                                                                                                                                                                                                                              |
| `./gradlew assembleDebug --no-daemon` (from `android/`)                                                | Failed before compilation completed: `java.io.IOException: No space left on device` while Gradle configured `:react-native-keychain`. This is an environment-capacity failure and does not establish package build compatibility or incompatibility. |
| `adb devices`                                                                                          | No device was connected during the initial spike. A device was connected for the follow-up recorded below.                                                                                                                                           |

## Physical-device runtime follow-up — 2026-10-09

The test device reported model `M2101K7BL`, Android API 33. The CI artifact `qleanfeel-android-debug-apk` from [PR #18 CI run 37958058426](https://github.com/qleanfeel-bot/qleanfeel-rn/actions/runs/37958058426) was verified to come from commit `b0378df7d53c0897af444715a1bc4991a18f7c08`. Its package ID was `com.qleanfeel.app`, and its signing certificate matched the already-installed Qleanfeel app. It was installed with `adb install -r`, preserving app data; no uninstall or data clear was performed. APK SHA-256: `fdceb90c6d5aa9a80c40c3c83f1294ff31076fb869e2f7a095880f6618d2b0b8`.

The debug APK initially displayed React Native's expected missing-bundle screen because debug builds load JavaScript from Metro. The running local Metro server reported `packager-status:running`; a temporary USB `adb reverse` was used while the app ran and removed afterward. No storage values or device serial were recorded.

| Runtime check                                          | Result                                                                                                                                                                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Write synthetic value and native read-back comparison  | **PASS** — harness reported write verified.                                                                                                                                                                                 |
| Read and compare stored synthetic value                | **PASS** — harness reported read verified.                                                                                                                                                                                  |
| Replace with a different synthetic value and read back | **PASS** — harness reported replacement verified.                                                                                                                                                                           |
| Fully stop and relaunch the app, then check storage    | **PASS** — harness read a value matching one of its fixed synthetic test values. The harness reports presence/match but does not distinguish which fixed value; the replacement had passed immediately before the relaunch. |
| Delete and verify absence                              | **PASS** — delete's immediate native read-back reported no value. A separate read afterward also reported no stored value.                                                                                                  |
| Uninstall/reinstall persistence                        | **NOT RUN** — not required for this spike; the existing app installation and its data were preserved.                                                                                                                       |

The harness's fixed synthetic values are used only for equality checks and never displayed or logged. No Firebase credentials, Qleanfeel tokens, or personal data were used.

## Recommendation and next evidence needed

The CI Android build and the device-level operation/restart checks support `react-native-keychain` 10.0.0 as the secure-storage candidate for M8-B on the tested React Native/New Architecture setup and Android API 33 device. The local `assembleDebug` attempt still failed for lack of host disk space, but the PR CI APK built successfully. The result is limited to one device/API level; uninstall/reinstall persistence and broader Android compatibility were not tested. This spike does not implement or approve the wider Session Foundation.

ADR-025 is unchanged. This note records the observed spike results without changing the approved architecture or asserting Firebase/session behavior.
