# Technical debt and deferred engineering work

This register tracks known engineering work intentionally deferred from the current milestone. It is not a product-feature roadmap. Items remain open until implementation and verification are completed; no due dates are implied.

| ID | Area | Technical Debt / Deferred Work | Priority | Status | Target / Trigger |
| --- | --- | --- | --- | --- | --- |
| TD-001 | Authentication | Replace the development-only in-memory authentication composition with a production composition using real provider/backend implementations. | High | OPEN | Before production authentication |
| TD-002 | Authentication | Implement the concrete Firebase Authentication adapter behind the existing provider boundary. | High | OPEN | Firebase/provider integration milestone |
| TD-003 | Backend | Implement `POST /v1/auth/bootstrap` for server-side credential verification and Qleanfeel identity provisioning. | High | OPEN | Backend/Auth milestone |
| TD-004 | Backend | Implement `GET /v1/me` for current Qleanfeel user and business/authorization context. | Medium | OPEN | Backend/Auth milestone |
| TD-005 | Authentication/Security | Define and implement production credential/session handling and secure persistence if required by the provider/session lifecycle. | High | OPEN | Before production authentication or credential persistence |
| TD-006 | Security | Implement server-side authorization and resource-ownership enforcement; never rely on client assertions as authority. | High | OPEN | Before protected backend resources are exposed |
| TD-007 | Release | Replace the development/CI debug-keystore signing configuration with proper production signing and secret handling. | High | OPEN | M12 / before production distribution |
| TD-008 | Testing | Add real Firebase and backend integration tests after concrete provider/API implementations exist. | Medium | OPEN | After provider and backend integration |
| TD-009 | CI/Tooling | Review and address GitHub Actions or toolchain deprecation warnings when applicable. | Low | OPEN | CI/tooling maintenance when warnings require action |
| TD-010 | CI/Testing | Consider explicit CI assertions for release APK bundle contents and standalone runtime behavior; manual artifact/device verification is already recorded. | Low | OPEN | CI hardening if automated assertions are useful |
| TD-011 | Profile/Backend | Connect the implemented Profile HTTP/API boundaries to the production backend base URL and verify the agreed contract against a live backend. | High | OPEN | When backend is available |
| TD-012 | Authentication/Security | Replace `DevelopmentAccessTokenProvider` with a production implementation that obtains a current authenticated API token; define refresh and secure lifecycle without conflating it with `ProviderCredential`. | High | OPEN | Provider/backend integration |
| TD-013 | Calendar/Backend | Connect the Calendar HTTP/API boundary to a real Qleanfeel backend and persistent storage. The current development chain ends at an in-memory HTTP handler; future production flow is `HttpTransport` → real Qleanfeel Backend → database. This is future integration work, not a current bug. | High | OPEN | When backend is available |
| TD-014 | Calendar/Testing | Add real backend integration/E2E verification for authentication context and ownership, Calendar CRUD, 401/403/404/409 responses, validation, and persistence. | Medium | OPEN | After Calendar backend implementation |
| TD-015 | Navigation | Revisit whether a full navigation library is needed if the authenticated screen count grows materially. The current Profile/Calendar shell switches using local React state. | Low | OPEN | If navigation needs exceed the current two-screen shell |

Real provider/backend integration, production authentication, production credential persistence, and production signing are not implied by M1 completion. M1 completed the provider-independent mobile foundation and its current fake-backed test/CI/release-device verification.

M3 completion does not close production backend persistence, server authorization/ownership, or real provider/backend integration work. Calendar's in-memory HTTP composition is for development verification only.
