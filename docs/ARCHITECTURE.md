# Architecture

## Current state — IMPLEMENTED

- The mobile application uses React Native. `App.tsx` is at the repository root and currently renders a minimal Qleanfeel placeholder screen.
- Android and iOS native project shells are present. Both use the application/bundle identifier `com.qleanfeel.app`.
- Android enables the New Architecture and Hermes. Android builds include debug and release variants; the release build bundles JavaScript for Metro-independent runtime use.
- There is no implemented feature-module tree under `src/`, backend, API layer, authentication system, or application data architecture yet.
- The existing Jest coverage is a single test that checks rendering of the root placeholder component.
- GitHub Actions runs TypeScript, ESLint, Jest, Android debug and release builds, and uploads both APK artifacts.

## Planned target structure — PLANNED

The following is a direction for organizing future application code. It does not describe modules that currently exist.

```text
src/
├── app/
├── features/
│   ├── auth/
│   ├── orders/
│   ├── calendar/
│   ├── evidence/
│   ├── emergency/
│   ├── finance/
│   ├── reports/
│   ├── profile/
│   ├── rewards/
│   └── marketplace/
├── shared/
│   ├── ui/
│   ├── api/
│   ├── storage/
│   ├── validation/
│   └── utils/
└── infrastructure/
    ├── analytics/
    ├── notifications/
    └── security/
```

The eventual backend direction is a modular monolith initially. No backend implementation or service topology is established yet.

## Architectural principles

- Organize application code by feature and keep feature boundaries explicit.
- Separate UI, application logic, data access, and infrastructure responsibilities as those layers are introduced.
- Treat the backend as the authority for authorization; do not trust client-side checks as enforcement.
- Handle authentication tokens securely when authentication is implemented.
- Keep components and application behavior testable.
- Deliver work in small, incremental milestones.
- Prefer a modular monolith initially; avoid premature microservices or Kubernetes complexity.
- Add infrastructure only to meet a concrete requirement.

These are governance principles for future work, not claims that corresponding systems already exist.

## Remote-first development

The intended operating model is Phone as the primary control/interface, GitHub as the source of truth, GitHub Actions as the reproducible CI/build environment, Xubuntu as the persistent remote engineering workstation, Codex for development and verification automation, and physical devices for hardware validation when required. This supports remote operation where practical and does not prohibit local development.
