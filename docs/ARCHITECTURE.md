# Architecture

For the current and planned module/data-flow views, see the [Living Architecture Map](ARCHITECTURE_MAP.md). This document retains the narrative and milestone-era details; the map uses `main` implementation state while ADRs and the roadmap remain their respective sources of truth.

## Current state — IMPLEMENTED

- The mobile application uses React Native. `App.tsx` at the repository root renders `AuthGate`, which observes application auth state and selects the login, loading, or authenticated shell.
- After authentication, `AuthGate` renders `AuthenticatedAppShell`, a thin layout wrapper which mounts the React Navigation root. The application and navigation structure is:

  ```text
  AuthGate
    ↓
  AuthenticatedAppShell (layout wrapper)
    ↓
  RootNavigator
    ↓
  MainNavigator
    ├── Home
    ├── CalendarStack
    │   ├── WeekView
    │   ├── DaySummary
    │   └── OrderDetails
    ├── OrdersStack
    │   ├── OrdersList
    │   ├── AddOrder
    │   └── OrderDetails
    └── Profile
  ```

  Home, Calendar, Orders, and Profile are the four bottom-tab root surfaces. Calendar and Orders each own a native stack. `AuthGate` remains the authentication boundary; navigation does not own or duplicate domain state. M5 navigation decisions and Android setup are recorded in [ADR-013](ADR-013-navigation-application-shell.md).
- Android and iOS native project shells are present. Both use the application/bundle identifier `com.qleanfeel.app`.
- Android enables the New Architecture and Hermes. Android builds include debug and release variants; the release build bundles JavaScript for Metro-independent runtime use.
- The implemented authentication foundation is organized under `src/domain/auth/`, `src/application/auth/`, and `src/presentation/auth/`. It includes provider-independent domain entities/contracts, `AuthStateController`, a provider/API boundary, `LoginScreen`, and `AuthGate`.
- The app uses `src/development/auth/createDevelopmentAuthController.ts` for an in-memory UI preview. This development composition is not production authentication and does not provide Firebase, a real backend, or credential persistence.
- The current mobile Jest suite has 30 suites and 276 tests. These tests exercise mobile domain/application and presentation behavior with fakes and development in-memory handlers; they are not real mobile-to-backend integration tests. Backend tests are tracked separately in [TEST_MATRIX.md](TEST_MATRIX.md).
- The release APK has been installed and tested on physical Android hardware using the development authentication composition. Release signing still uses the debug keystore; production signing is not configured.
- GitHub Actions runs TypeScript, ESLint, Jest, Android debug and release builds, and uploads both APK artifacts.

## M6 business architecture — approved, implementation deferred

The repository audit and approved target model are recorded in [M6_ARCHITECTURE_PROPOSAL.md](M6_ARCHITECTURE_PROPOSAL.md), with the field-level [Domain/Data Dictionary](DOMAIN_DATA_DICTIONARY.md) and ADR-014–017 indexed in [DECISIONS.md](DECISIONS.md#m6-adrs--approved-architecture). These documents define architecture only; they do not change the implemented M1–M5 system or authorize implementation work.

The proposal keeps one future canonical Order across manual, Qleanfeel, and client origins, and separates Order, CalendarEntry, and Cleaning. Any future Money/FinancialEvent/Ledger behavior remains outside Home and requires a separate financial design; Dashboard is a future read projection. Future Messaging, Evidence, Disputes, and Settlement remain independent boundaries. The current ManualOrder, CalendarEntry, Profile, API contracts, and development composition remain as implemented until an explicitly approved migration. Current in-memory development HTTP handlers and sequential CalendarEntry/ManualOrder creation are not production persistence or a production transaction.

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

The backend is now implemented as a NestJS modular-monolith foundation under `backend/src/`, with identity/authentication, health, PostgreSQL persistence, and the Application authorization boundary. Production business modules for Profile, Orders, Cleaning, and Calendar remain planned. The mobile source tree still uses the existing layer folders shown above; the proposed `src/app` / `src/features` structure is not current code.

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

## Authentication — BACKEND FOUNDATION IMPLEMENTED; MOBILE PRODUCTION INTEGRATION PLANNED

The backend has provider-independent `User`, `AuthIdentity`, `AuthSession`, and refresh-token domain concepts. Firebase Admin verifies identity proof at bootstrap and returns a normalized provider subject; the Firebase UID is not the Qleanfeel User ID. Bootstrap resolves or provisions the Qleanfeel identity and creates a session. Protected requests use Qleanfeel-issued access credentials and current server-side session/account state. See [ADR-019](ADR-019-identity-authentication-foundation.md).

### Mobile state and provider boundary — CONTRACTS IMPLEMENTED; APP STILL USES DEVELOPMENT COMPOSITION

The mobile Domain/Application boundary is provider-agnostic. Provider-specific SDK types and exceptions must stay inside a future adapter. Current contracts make the boundary explicit:

```text
AuthStateController
       ↓
AuthProviderAdapter / AuthApi ports
       ↓
development in-memory composition (currently wired)
```

`AuthStateController` owns mobile application authentication state. Its provider/API ports and the development fake remain in place, but the current mobile app does not call the production backend or use a mobile Firebase adapter. The backend Firebase verifier, Qleanfeel access/refresh credentials, session persistence, and authenticated-principal resolution are implemented separately. The mobile API transport remains connected to the development in-memory handler.

`AuthGate` is a Presentation-layer consumer of `AuthStateController`: it subscribes, initiates restoration through the controller, and selects loading, LoginScreen, or `AuthenticatedAppShell`. The authenticated shell mounts `RootNavigator`; `MainNavigator` provides Home, Calendar, Orders, and Profile root tabs. ProfileScreen obtains profile data through `ProfileService`, displays the Qleanfeel profile card with the authenticated account status, and provides logout. `LoginScreen` submits user actions through the controller; when rendered by AuthGate it receives the current AuthState and does not own global auth state or restoration lifecycle. It retains only UI-local form input. The current App composition uses `src/development/auth/createDevelopmentAuthController.ts`, an in-memory development-only fake; it is not production authentication and must not be treated as such.

### Backend identity and authorization — FOUNDATION IMPLEMENTED; RESOURCE POLICIES INTRODUCED WITH BUSINESS MODULES

The production backend implements `POST /v1/auth/bootstrap`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, and `GET /v1/me`. Firebase proves external identity at bootstrap only. Protected requests use Qleanfeel-issued credentials; the access guard resolves the server-side `AuthenticatedPrincipal` after credential, session, and account checks. Invalid credentials receive `401`; a suspended account receives `403`.

The M7-B.3 Application boundary represents permit/deny, policy evaluation, and authorization denial without NestJS or persistence dependencies. It does not implement business ownership, assignment, or participation policies because the production business modules are not yet present. Client-provided identity, creator, ownership, role, capability, assignment, and session claims are not authorization facts. See [ADR-020](ADR-020-authorization-foundation.md). M7-B.4's scoped active-account rule is documented in [ADR-021](ADR-021-canonical-order-creation-and-optional-scheduling.md); it is not a final role or capability model.

HTTP semantics remain distinct: `401 Unauthorized` means authentication is absent or invalid; `403 Forbidden` means the authenticated caller is denied, including the existing suspended-account behavior. A future resource API may deliberately return `404` to hide resource existence. Mapping belongs to HTTP adapters.

### Profile — MOBILE UI, HTTP/API BOUNDARIES, AND DEVELOPMENT CHAIN IMPLEMENTED; BACKEND CONTRACT ONLY

The provider-independent Profile model, `ProfileRepository` contract, and `ProfileService` are implemented. The Profile screen supports viewing profile data and editing only `displayName`. `ProfileApiRepository` adapts the existing repository contract to `ProfileApi` and the provider-independent `HttpTransport`. App uses a development composition with an in-memory HTTP handler and a development-only `AccessTokenProvider`; profile reads and edits exercise the same API/mapping/transport chain without a server. This is not production persistence and does not connect to a backend.

For production, the backend is the authoritative source for Profile data. The UI continues to call `ProfileService`; the infrastructure implementation uses the existing `ProfileRepository` contract. HTTP details must not enter the Profile domain or UI.

The authenticated request boundary is separate from authentication state and provider credentials:

```text
ProfileScreen → ProfileService → ProfileRepository
  → ProfileApiRepository → ProfileApi → HttpTransport
AccessTokenProvider → HttpTransport
```

The current development composition connects `HttpTransport` to an in-memory HTTP handler. A production Profile backend and persistence are not implemented.

`AccessTokenProvider` only supplies an opaque API access token. It does not manage login/logout or retain User/AuthState. It is distinct from `ProviderCredential`, which the auth flow passes to `AuthApi`. No Firebase adapter, token refresh, production credential persistence, or production backend URL is implemented.

Both endpoints require an authenticated request. The caller's identity is resolved by the backend from the trusted authentication context; the client does not select a profile using a `userId` path, query, or request-body field. `ProfileRepository` retains its `userId` argument for application consistency; the API always calls `/v1/me/profile`, and a response whose `profile.userId` differs from the requested ID is rejected. M2.5 established the token-provider boundary and HTTP implementation but did not implement production authentication, token storage, or refresh behavior.

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

### Calendar — MOBILE DEVELOPMENT CHAIN IMPLEMENTED; FULL PRODUCTION CALENDAR API ABSENT

The Calendar domain and UI are implemented behind provider-independent application and repository boundaries. The current chain is:

```text
CalendarScreen
  → CalendarService
  → CalendarRepository
  → CalendarApiRepository
  → CalendarApi
  → HttpTransport
  → development in-memory HTTP handler
```

The full production Calendar API and general Calendar persistence workflows do not exist yet. M7-B.4 adds CalendarEntry persistence only as part of canonical Order creation when a schedule is requested; that implementation is in Draft PR #11 and is not merged into `main`. The in-memory handler remains a development implementation of the mobile HTTP boundary.

`CalendarEntry` contains `id`, `startAt`, `endAt`, `type`, `status`, and `title`. `startAt` and `endAt` are absolute UTC ISO-8601 timestamps and must satisfy `startAt < endAt`. Calendar intervals use half-open semantics `[startAt, endAt)`. Initial types are `external_order`, `blocked`, and `personal`; statuses are `scheduled`, `cancelled`, and `completed`.

The server assigns `id` and owns `status`. The client does not send `userId` or ownership information. Backend ownership and authentication must be determined from the authenticated identity; client-provided identity is not authoritative.

The Calendar API contract in [ADR-011](ADR-011-calendar.md) is:

```text
GET    /v1/me/calendar/entries?from=<ISO-8601>&to=<ISO-8601>
GET    /v1/me/calendar/entries/{entryId}
POST   /v1/me/calendar/entries
PATCH  /v1/me/calendar/entries/{entryId}
DELETE /v1/me/calendar/entries/{entryId}
```

For GET, both range bounds are required, `from < to`, and an entry is returned when `entry.startAt < to && from < entry.endAt`. These Calendar CRUD endpoints are contracts exercised by the development handler; they do not imply a production Calendar CRUD API. The scoped M7-B.4 Order-creation path separately persists a scheduled CalendarEntry in Draft PR #11.

### Manual Orders — MOBILE DEVELOPMENT FLOW AND CANONICAL PRODUCTION CREATE PATH IN DRAFT PR #11

ManualOrder is a separate domain entity from CalendarEntry. It owns customer and service snapshots, address, optional phone/quoted price/notes, its server-assigned `id` and `createdAt`, and a `calendarEntryId` reference. It does not contain `startAt`, `endAt`, `userId`, or an Order status. Client create requests do not contain server-owned IDs, timestamps, user identity, or status.

CalendarEntry remains the scheduling boundary and owns `startAt`, `endAt`, `type`, `status`, and `title`. M4 does not add `orderId` to CalendarEntry. Order Details loads the ManualOrder and then fetches its associated CalendarEntry by ID.

The current ManualOrder chain is:

```text
ManualOrdersScreen
  → ManualOrderService
  → ManualOrderRepository
  → ManualOrderApiRepository
  → ManualOrderApi
  → HttpTransport
  → development in-memory HTTP handler
```

The current authenticated Orders API contract is:

```text
GET  /v1/me/manual-orders
POST /v1/me/manual-orders
GET  /v1/me/manual-orders/{orderId}
```

`CreateScheduledManualOrder` coordinates Calendar creation and ManualOrder creation through the existing application services. If M4 ManualOrder creation fails after Calendar creation, it attempts to delete the newly created CalendarEntry and propagates the original failure. If compensation also fails, it returns a safe compensation error. This M4 flow remains development-only and is not a transaction. The separate canonical `POST /v1/me/orders` production path, with persistence and atomic Order/Cleaning/optional scheduling, is implemented in Draft PR #11 and is not yet merged into `main`.

The development HTTP router explicitly sends `/v1/me/manual-orders` requests to the in-memory ManualOrder handler. ManualOrder and Calendar state created through that M4 development flow are process-local and are lost when the development composition is recreated. The canonical production Order persistence is present on the Draft PR #11 feature branch, but is not yet part of `main` and is not connected to the mobile flow.

### M5 — Cleaner Application Shell & Navigation — IMPLEMENTED

M5 adds the authenticated React Navigation shell described above. `MainNavigator` exposes four bottom-tab root surfaces: Home, Calendar, Orders, and Profile. Calendar is a stack of `WeekView`, `DaySummary`, and `OrderDetails`; Orders is a stack of `OrdersList`, `AddOrder`, and `OrderDetails`. Both stacks render the same `OrderDetailsScreen` implementation. `AuthGate` still decides whether the user sees loading, login, or authenticated content; navigation is not an authentication or business-data boundary.

CalendarEntry continues to own scheduling and Calendar status. ManualOrder continues to own customer/service details and its `calendarEntryId` reference. Creating a Calendar `external_order` calls the existing `CreateScheduledManualOrder` application service, which creates the CalendarEntry and associated ManualOrder. `personal` and `blocked` entries remain CalendarEntry-only. Calendar display mapping resolves orders through this link; navigation passes identifiers and does not copy domain records into route state.

Calendar's week pager owns horizontal gestures while the Calendar root tab has `swipeEnabled: false`. Root tab swiping remains enabled on Home, the Orders list, and Profile; it is disabled while nested Calendar/Orders routes are focused. The MonthSelector is a presentation/navigation control that changes the selected week to the one containing the chosen date; it introduces no domain entity. Nested screens use their owning native stack for back navigation. See [ADR-013](ADR-013-navigation-application-shell.md) for the decision and Android-specific details.

For Android native navigation setup, `MainActivity` installs `RNScreensFragmentFactory` before calling the superclass so `react-native-screens` can avoid restoring its screen fragments as ordinary saved Activity state. The application-level `android:enableOnBackInvokedCallback="false"` is a compatibility opt-out from predictive-back dispatch while React Native/React Navigation use the `OnBackPressedDispatcher` and `BackHandler` flow. The M5 physical smoke test verified nested back flows on Android; it did not verify Activity process recreation or predictive-back animations. These native choices and their validation limits are recorded in ADR-013.

M5 scope is the application shell, navigation, Calendar presentation navigation, and integration of existing Profile, Calendar, and ManualOrder behavior. It does not include Finance, Expenses, Reports, Web3, camera/media, Emergency backend, GPS, Client/Marketplace, production backend, or a root information-architecture redesign.

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
