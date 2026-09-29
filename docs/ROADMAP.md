# Qleanfeel roadmap

This roadmap separates the implemented foundation from planned product work. A planned milestone does not imply that its features exist.

## Milestones

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 — Foundation | React Native project initialized; Android/iOS identifiers normalized; basic project validation; debug build; CI; standalone Android release build | **COMPLETE** |
| M0.5 — Project Governance | Project documentation; architecture rules; decision log; test matrix; remote-first development workflow | **COMPLETE** |
| M1 — Authentication | Provider-independent mobile authentication foundation and remaining verification/integration milestones below | **IN PROGRESS** |
| M2 — User/Profile | User profile and account information | **PLANNED** |
| M3 — Calendar | Calendar and scheduling workflows | **PLANNED** |
| M4 — Manual Orders | Manual order workflows | **PLANNED** |
| M5 — Evidence | Evidence capture and handling | **PLANNED** |
| M6 — Emergency | Emergency workflows | **PLANNED** |
| M7 — Finance | Finance workflows | **PLANNED** |
| M8 — Reports | Reporting workflows | **PLANNED** |
| M9 — Notifications | Notification workflows | **PLANNED** |
| M10 — Client/Marketplace foundations | Initial client and marketplace foundations | **PLANNED** |
| M11 — Security hardening | Security review and hardening | **PLANNED** |
| M12 — Production release preparation | Production readiness and release preparation | **PLANNED** |

The mobile authentication domain, application state boundary, Login UI, and AuthGate are implemented. The app currently uses an in-memory development composition; real Firebase/backend integration and final M1 verification remain planned. M2–M12 are planning labels, not claims of existing functionality or settled implementation details.

### M1 — Authentication decomposition

M1.0 through M1.6 are complete. M1.7 through M1.9 remain planned; current boundary-level Jest tests and the existing general CI workflow do not constitute final authentication verification or release/device validation.

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
| M1.6 — AuthGate | Select loading, login, or authenticated placeholder from AuthStateController state | **COMPLETE** |
| M1.7 — Tests / final M1 test coverage | Complete any remaining M1 test coverage; current boundary/UI tests use fakes and do not verify real provider/backend integration | **PLANNED** |
| M1.8 — CI verification | Complete M1-specific CI verification; general TypeScript, lint, Jest, and Android build/artifact CI already exists | **PLANNED** |
| M1.9 — Release APK + physical-device verification | Verify the M1 auth application in a release APK and complete required physical-device checks | **PLANNED** |

`POST /v1/auth/bootstrap` and `GET /v1/me` are planned contracts only; neither endpoint exists yet. Firebase Authentication is the planned first provider, not an existing integration.

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
