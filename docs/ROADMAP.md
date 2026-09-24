# Qleanfeel roadmap

This roadmap separates the implemented foundation from planned product work. A planned milestone does not imply that its features exist.

## Milestones

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 — Foundation | React Native project initialized; Android/iOS identifiers normalized; basic project validation; debug build; CI; standalone Android release build | **COMPLETE** |
| M0.5 — Project Governance | Project documentation; architecture rules; decision log; test matrix; remote-first development workflow | **COMPLETE** |
| M1 — Authentication | Authentication flows and session handling | **PLANNED** |
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

The current application is still a minimal foundation and placeholder. The descriptions for M1–M12 are planning labels, not claims of existing functionality or settled implementation details.

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
