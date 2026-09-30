# Architecture

## Current state — IMPLEMENTED

- The mobile application uses React Native. `App.tsx` at the repository root renders `AuthGate`, which observes application auth state and selects the login, loading, or authenticated Profile surface.
- Android and iOS native project shells are present. Both use the application/bundle identifier `com.qleanfeel.app`.
- Android enables the New Architecture and Hermes. Android builds include debug and release variants; the release build bundles JavaScript for Metro-independent runtime use.
- The implemented authentication foundation is organized under `src/domain/auth/`, `src/application/auth/`, and `src/presentation/auth/`. It includes provider-independent domain entities/contracts, `AuthStateController`, a provider/API boundary, `LoginScreen`, and `AuthGate`.
- The app uses `src/development/auth/createDevelopmentAuthController.ts` for an in-memory UI preview. This development composition is not production authentication and does not provide Firebase, a real backend, or credential persistence.
- M1's authentication test suites historically had 44 passing tests. The current full Jest suite has 90 passing tests across M1, M2, and infrastructure tests. These suites exercise domain/application and presentation behavior with fakes; they are not real provider/backend integration tests.
- The release APK has been installed and tested on physical Android hardware using the development authentication composition. Release signing still uses the debug keystore; production signing is not configured.
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

## Authentication — MOBILE FOUNDATION IMPLEMENTED; PROVIDER/BACKEND INTEGRATION PLANNED

The provider-independent mobile authentication foundation is implemented. Real authentication against an external provider and backend is not. Firebase Authentication is the planned first provider, not currently integrated. Its UID identifies an external provider subject; it is not the Qleanfeel User ID. `User`, `AuthIdentity`, and `AuthSession` are provider-independent Qleanfeel domain concepts; AuthIdentity links an internal User to an external identity:

```text
Firebase identity (providerSubject = Firebase UID)
                         ↓
                    AuthIdentity
                         ↓
                  Qleanfeel User
```

AuthIdentity fields are `id`, `userId`, `provider`, `providerSubject`, `createdAt`, and `lastAuthenticatedAt`. For a future Firebase adapter, `provider` is `firebase`, and `providerSubject` is the Firebase UID. AuthSession is separate from User and AuthIdentity and contains no provider credential. The current AuthApi contract returns the Qleanfeel User; the controller does not synthesize an AuthSession. No custom Qleanfeel token/session system or credential persistence is implemented.

### Mobile state and provider boundary — IMPLEMENTED CONTRACTS; PROVIDER ADAPTER PLANNED

The mobile Domain/Application boundary is provider-agnostic. Provider-specific SDK types and exceptions must stay inside a future adapter. Current contracts make the boundary explicit:

```text
AuthStateController
       ↓
AuthProviderAdapter / AuthApi ports
       ↓
future provider adapter / backend API implementation
```

`AuthStateController` owns application authentication state and coordinates restoration, OTP request/verification, and logout through the ports. Provider failures are represented with provider-independent auth error codes. No Firebase adapter, concrete provider implementation, or HTTP/API client currently exists.

`AuthGate` is a Presentation-layer consumer of `AuthStateController`: it subscribes, initiates restoration through the controller, and selects loading, LoginScreen, or the authenticated `ProfileScreen`. ProfileScreen obtains profile data through `ProfileService`, displays the Qleanfeel profile card with the authenticated account status, and preserves the existing logout action. `LoginScreen` submits user actions through the controller; when rendered by AuthGate it receives the current AuthState and does not own global auth state or restoration lifecycle. It retains only UI-local form input. The current App composition uses `src/development/auth/createDevelopmentAuthController.ts`, an in-memory development-only fake; it is not production authentication and must not be treated as such.

Firebase is planned as the first provider but is not integrated. Backend authentication/API is planned; `POST /v1/auth/bootstrap` and `GET /v1/me` do not exist. No production credential persistence or production signing is configured.

### Backend identity and authorization — PLANNED

The backend is intended to be authoritative for authorization. Authentication establishes who the caller is; authorization determines what the caller may do; resource ownership determines whether the caller may access a particular resource. The client must never be trusted to assert `userId`, `role`, permissions, or ownership. User roles are business/authorization state, not authentication identity; the model must allow multiple roles, for example `roles: ["CLIENT", "CLEANER"]`. Backend authorization and role behavior are not implemented.

The future backend provider boundary is expected to verify an external credential, resolve the external identity, and then resolve that identity to a Qleanfeel User:

```text
Authentication Provider Layer
├── FirebaseVerifier
├── FutureCustomVerifier
└── FutureWeb3Verifier

external credential → verified external identity → AuthIdentity → Qleanfeel User
```

The planned initial mobile/backend contract sends `Authorization: Bearer <Firebase ID token>`. The future backend must verify this token server-side. The mobile client must not treat a token as valid merely because it can decode it locally.

Planned endpoints (neither exists yet):

| Endpoint | Planned purpose |
| --- | --- |
| `POST /v1/auth/bootstrap` | Verify the external credential; resolve or create AuthIdentity and Qleanfeel User; return the Qleanfeel authenticated identity/context. |
| `GET /v1/me` | Return the current Qleanfeel User and read current authorization/business identity state. |

HTTP semantics distinguish failure to establish authentication from an authenticated but disallowed action: `401 Unauthorized` for missing, invalid, or expired credentials; `403 Forbidden` when authentication succeeds but the action is not permitted. A protected resource may return `404` when hiding its existence is desirable. The appropriate `403`/`404` behavior is resource-specific; there is no single rule for all resources.

### Profile — MOBILE UI, HTTP/API BOUNDARIES, AND DEVELOPMENT CHAIN IMPLEMENTED; BACKEND CONTRACT ONLY

The provider-independent Profile model, `ProfileRepository` contract, and `ProfileService` are implemented. The Profile screen supports viewing profile data and editing only `displayName`. `ProfileApiRepository` adapts the existing repository contract to `ProfileApi` and the provider-independent `HttpTransport`. App uses a development composition with an in-memory HTTP handler and a development-only `AccessTokenProvider`; profile reads and edits exercise the same API/mapping/transport chain without a server. This is not production persistence and does not connect to a backend.

For production, the backend is the authoritative source for Profile data. The UI continues to call `ProfileService`; the infrastructure implementation uses the existing `ProfileRepository` contract. HTTP details must not enter the Profile domain or UI.

The authenticated request boundary is separate from authentication state and provider credentials:

```text
ProfileScreen → ProfileService → ProfileRepository
  → ProfileApiRepository → ProfileApi → HttpTransport → Qleanfeel backend
AccessTokenProvider → HttpTransport
```

`AccessTokenProvider` only supplies an opaque API access token. It does not manage login/logout or retain User/AuthState. It is distinct from `ProviderCredential`, which the auth flow passes to `AuthApi`. No Firebase adapter, token refresh, production credential persistence, or production backend URL is implemented.

Both endpoints require an authenticated request. The caller's identity is resolved by the backend from the trusted authentication context; the client does not select a profile using a `userId` path, query, or request-body field. `ProfileRepository` retains its `userId` argument for application consistency; the API always calls `/v1/me/profile`, and a response whose `profile.userId` differs from the requested ID is rejected. M2.5 adds the token-provider boundary and HTTP implementation but does not implement production authentication, token storage, or refresh behavior.

#### `GET /v1/me/profile` — CONTRACT IMPLEMENTED CLIENT-SIDE; BACKEND PLANNED

Returns the current authenticated user's Profile. A successful response uses HTTP `200 OK` and a `profile` object compatible with the current domain model:

```json
{
  "profile": {
    "userId": "qleanfeel-user-id",
    "displayName": "Alex",
    "phone": null,
    "email": null,
    "avatar": null,
    "locale": null,
    "country": null
  }
}
```

`userId` is supplied by the backend and is not an input for choosing whose profile to read. The nullable fields are returned as `null` when no value is available. If no Profile exists, the endpoint returns `404 Not Found` with `PROFILE_NOT_FOUND`; it does not create one implicitly. Responses contain profile data only, not credentials or session data.

#### `PATCH /v1/me/profile` — CONTRACT IMPLEMENTED CLIENT-SIDE; BACKEND PLANNED

Updates only the authenticated user's display name. The request body contains only the editable field:

```json
{ "displayName": "Alex" }
```

The backend trims surrounding whitespace, rejects a value that is empty after trimming, and limits the name to 80 characters, matching the current mobile input limit. Request bodies containing fields other than `displayName` are rejected with `VALIDATION_ERROR`; this is not a general Profile update. A successful update returns HTTP `200 OK` with the complete updated `profile` shape shown above. If no Profile exists, it returns `404 Not Found` with `PROFILE_NOT_FOUND`; it does not create a Profile as a side effect.

#### Profile API errors — CONTRACT IMPLEMENTED CLIENT-SIDE; BACKEND PLANNED

Profile endpoint errors use a small JSON envelope with a stable code and a safe message:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Display name is invalid."
  }
}
```

The minimum categories are `401 Unauthorized` / `UNAUTHORIZED` for absent or invalid authentication, `403 Forbidden` / `FORBIDDEN` when an authenticated request is not permitted, `404 Not Found` / `PROFILE_NOT_FOUND` when the current user's Profile is absent, `400 Bad Request` / `VALIDATION_ERROR` for an invalid display name, and `500 Internal Server Error` / `INTERNAL_ERROR` for an unexpected server failure. Error messages must not expose stack traces or internal details. These endpoint-specific statuses do not define a universal `403` versus `404` policy for other resources.

### Future Web3 compatibility — FUTURE

Web3 remains future work and is not part of M1 implementation. A future model may represent a wallet separately from authentication identity:

```text
User
├── AuthIdentity
│   └── Firebase
└── WalletIdentity
```

A wallet is not automatically an authentication identity. A possible future business flow is a completed/validated business event → reward calculation → reward issuance → optional blockchain settlement. None of these capabilities is implemented or included in M1.

## Remote-first development

The intended operating model is Phone as the primary control/interface, GitHub as the source of truth, GitHub Actions as the reproducible CI/build environment, Xubuntu as the persistent remote engineering workstation, Codex for development and verification automation, and physical devices for hardware validation when required. This supports remote operation where practical and does not prohibit local development.
