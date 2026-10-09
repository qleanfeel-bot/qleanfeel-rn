# M8-B.0 — Secure Storage Compatibility Spike

## Result

**Status: PASS WITH LIMITATIONS.** `react-native-keychain` 10.0.0 was added as the only direct dependency change. React Native CLI configuration discovers its Android native module, and the JavaScript harness passes unit tests, lint, and typecheck. The Android build did not reach compilation because the host ran out of disk space while Gradle configured `:react-native-keychain`. No Android emulator or device was connected, so no native storage operation, process-restart persistence, or uninstall/reinstall behavior has been verified. This evidence is insufficient by itself to approve the library for production session storage.

## Configuration examined

The spike used the repository's React Native CLI Android project: React Native 0.87.1, React 19.2.3, Android New Architecture enabled, Kotlin 2.2.0, compile SDK 37, target SDK 36, min SDK 24, and application ID `com.qleanfeel.app`. The project uses npm and `package-lock.json`.

`react-native-keychain` 10.0.0 was selected because npm reported it as the current `latest` tag during the spike and its package metadata declares Node.js `>=16`, no runtime package dependencies, and a React Native Codegen module (`RNKeychainSpec`). Its Android Gradle configuration declares min SDK 23, below this app's min SDK 24. The package does not declare a peer dependency or published compatibility matrix for React Native 0.87.1. Its own package development metadata references React Native 0.77.1, which is not proof of incompatibility, but leaves an exact-version compatibility gap. Therefore an actual Android build and device check remain necessary.

## Isolated harness

`App.tsx` exposes a development-only control only on Android. It switches to `src/development/keychain/KeychainSpikeScreen.tsx`; the existing application remains the default and its auth/manual-order composition was not changed. The screen uses a dedicated service name and fixed synthetic values only. It offers write/read, replacement, delete, and a check operation intended for a relaunch check. It displays verification status only; stored values and native error details are neither displayed nor logged. The harness contains no Firebase, Qleanfeel token, Session Manager, or production authentication behavior.

The test in `src/development/keychain/__tests__/KeychainSpikeScreen.test.tsx` mocks the native module. It verifies the UI's operation wiring and safe status handling, not native encryption or persistence.

## Verification evidence

Commands and results from this checkout:

| Command                                                                                                | Result                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm view react-native-keychain@latest version peerDependencies dependencies engines dist-tags --json` | Reported latest `10.0.0`; Node engine `>=16`; no declared peer/runtime dependencies.                                                                                                                                                                 |
| `npm install --save-exact react-native-keychain@10.0.0`                                                | Passed. Only `package.json` and the matching `package-lock.json` entry changed; no transitive package was added. npm printed an aggregate audit count for the repository dependency tree; no audit remediation was in scope.                         |
| `./node_modules/.bin/react-native config`                                                              | Passed; Android config discovered `KeychainPackage` and `RNKeychainSpec` 10.0.0. This verifies CLI autolinking discovery, not a compiled native binary.                                                                                              |
| `npm test -- --runInBand src/development/keychain/__tests__/KeychainSpikeScreen.test.tsx`              | Passed: 1 suite, 2 tests.                                                                                                                                                                                                                            |
| `npx tsc --noEmit`                                                                                     | Passed.                                                                                                                                                                                                                                              |
| `npm run lint`                                                                                         | Passed.                                                                                                                                                                                                                                              |
| `./gradlew assembleDebug --no-daemon` (from `android/`)                                                | Failed before compilation completed: `java.io.IOException: No space left on device` while Gradle configured `:react-native-keychain`. This is an environment-capacity failure and does not establish package build compatibility or incompatibility. |
| `adb devices`                                                                                          | No emulator or device was connected.                                                                                                                                                                                                                 |

Because no device was available, write/read/replace/delete against native storage, app-process restart persistence, and uninstall/reinstall behavior were not run. No runtime result should be inferred from the mocked test or CLI configuration output.

## Recommendation and next evidence needed

Treat version 10.0.0 as a **provisional candidate**, not yet as a verified M8-B dependency. Repeat the Android debug build in an environment with sufficient free disk, then install on an owner-controlled emulator or test device and complete the screen's synthetic-value operations and restart check. Uninstall/reinstall behavior can be checked only on that isolated test installation. If those checks pass, the spike will support the ADR-025 candidate; it does not implement or approve the wider Session Foundation.

ADR-025 is unchanged. This note records the observed spike results without changing the approved architecture or asserting Firebase/session behavior.
