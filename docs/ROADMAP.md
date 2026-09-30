# Qleanfeel roadmap

This roadmap separates the implemented foundation from planned product work. A planned milestone does not imply that its features exist.

## Milestones

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 — Foundation | React Native project initialized; Android/iOS identifiers normalized; basic project validation; debug build; CI; standalone Android release build | **COMPLETE** |
| M0.5 — Project Governance | Project documentation; architecture rules; decision log; test matrix; remote-first development workflow | **COMPLETE** |
| M1 — Authentication | Provider-independent mobile authentication foundation, tests, CI, and release/device verification | **COMPLETE** |
| M2 — User/Profile | User profile and account information | **IN PROGRESS** |
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

M1 is complete as a provider-independent mobile authentication foundation with tests, CI, and release APK verification on a physical Android device. The app still uses an in-memory development composition; this is not production authentication. Real Firebase/backend integration, production credential/session handling, and production signing remain future work. M2–M12 remain planned and are not claims of existing functionality or settled implementation details.

M2.1–M2.4 profile domain, UI/editing flow, and API contract are implemented. M2.5 adds the provider-independent HTTP/API infrastructure, access-token port, safe error mapping, and a fully local development chain. No real backend integration is claimed.

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
| M2.5 — Real Profile Integration boundaries | HTTP/API/repository infrastructure, AccessTokenProvider port, development composition, and tests; live backend/provider remain future work | **IN PROGRESS** |

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
