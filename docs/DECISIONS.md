# Decision log

This log records accepted decisions only. Proposed architecture principles are documented in [ARCHITECTURE.md](ARCHITECTURE.md), not treated as additional accepted implementation decisions here.

## ADR-001 — React Native as the mobile application framework

- **Status:** Accepted
- **Decision:** Qleanfeel is being developed as a React Native mobile application for Android and iOS.
- **Context:** The project has been initialized with React Native; the current app is a minimal foundation/placeholder.

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
