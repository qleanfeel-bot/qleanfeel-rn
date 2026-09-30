# ADR-011 — M3 Calendar / Scheduling Model, Semantics and API Contract

* Status: Accepted
* Scope: M3.0 — Calendar architecture
* Decision date: 2026-09-30
* Depends on: ADR-007, ADR-010
* Implementation: Not implemented by this ADR

## Context

M3 introduces the first Calendar / Scheduling capability.

M0–M2 established the following mobile architecture:

```text
Presentation → Application → Domain repository contract
  → Infrastructure API repository → API → HttpTransport → future backend

AccessTokenProvider → HttpTransport
```

M3 preserves these boundaries. Calendar Domain and Application layers must not depend on HTTP, authentication providers, backend implementation details, or UI framework details.

Calendar is intentionally independent from the future Order domain. A `CalendarEntry` represents scheduled time and availability context; it is not an `Order`.

## Decision

### 1. Calendar is an independent domain

The central domain entity is `CalendarEntry`.

Initial entry types are:

* `external_order`
* `blocked`
* `personal`

A catch-all `other` type is deliberately excluded. New semantic types should be introduced explicitly when their behavior becomes relevant.

`CalendarEntry` remains separate from the future `Order` entity.

### 2. CalendarEntry model

The initial model contains:

* `id`
* `startAt`
* `endAt`
* `type`
* `status`
* `title`

The domain model must not contain:

* Firebase types
* authentication credentials
* bearer tokens
* HTTP concerns
* `fetch` / Axios types
* API URLs
* UI framework types
* backend persistence implementation details

### 3. Time semantics

Calendar timestamps represent absolute instants.

Transport format is ISO-8601 UTC.

The invariant is:

```text
startAt < endAt
```

Calendar intervals use half-open semantics:

```text
[startAt, endAt)
```

Therefore an entry ending at exactly the moment another entry starts does not overlap it.

The UI may display and edit dates and times in the user's local timezone, while the underlying model and API representation remain absolute instants.

The future backend will be the authoritative source for persisted calendar state.

### 4. Application operations

The Calendar application layer exposes:

```text
getEntries(from, to)
createEntry(entry)
updateEntry(entryId, changes)
deleteEntry(entryId)
```

The application layer orchestrates business operations and repository calls. It does not perform HTTP directly.

### 5. Repository boundary

The Calendar repository contract belongs to the Domain/Application boundary.

The infrastructure implementation is `CalendarApiRepository`.

The architecture is:

```text
CalendarScreen
  → CalendarService
  → CalendarRepository
  → CalendarApiRepository
  → CalendarApi
  → HttpTransport
  → future backend
```

### 6. API contract

The planned API endpoints are:

```text
GET    /v1/me/calendar/entries?from=<ISO-8601>&to=<ISO-8601>
POST   /v1/me/calendar/entries
PATCH  /v1/me/calendar/entries/{entryId}
DELETE /v1/me/calendar/entries/{entryId}
```

The client does not provide a `userId` for selecting resource ownership.

The `/me` boundary identifies the authenticated caller on the server.

### 7. List response shape

```json
{
  "entries": [
    {
      "id": "entry-123",
      "startAt": "2026-10-05T07:00:00Z",
      "endAt": "2026-10-05T10:00:00Z",
      "type": "external_order",
      "status": "scheduled",
      "title": "Cleaning"
    }
  ]
}
```

The API DTO is an infrastructure concern and must be mapped into the domain model at the infrastructure boundary.

### 8. Create request

```json
{
  "startAt": "2026-10-05T07:00:00Z",
  "endAt": "2026-10-05T10:00:00Z",
  "type": "blocked",
  "title": "Unavailable"
}
```

Ownership is resolved by the authenticated server context rather than by a client-provided user identifier.

### 9. API ownership and security

The backend is authoritative for:

* caller identity
* authorization
* resource ownership

The client must not treat `userId`, role, or ownership fields supplied by the client as authorization authority.

The existing authentication boundary remains:

```text
AccessTokenProvider → HttpTransport
```

M3 does not implement:

* production authentication
* token persistence
* token refresh
* production backend authorization
* production Firebase integration

### 10. API errors

Calendar API failures use stable error categories:

| HTTP status | Code                | Meaning                                          |
| ----------- | ------------------- | ------------------------------------------------ |
| 401         | `UNAUTHORIZED`      | Missing or invalid authentication                |
| 403         | `FORBIDDEN`         | Authenticated request is not permitted           |
| 404         | `ENTRY_NOT_FOUND`   | Requested calendar entry does not exist          |
| 400         | `VALIDATION_ERROR`  | Invalid calendar input                           |
| 409         | `CALENDAR_CONFLICT` | Calendar operation conflicts with existing state |
| 500         | `INTERNAL_ERROR`    | Unexpected server failure                        |

The error envelope is:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Calendar interval is invalid."
  }
}
```

Messages must remain safe and must not expose stack traces, credentials, or internal implementation details.

### 11. Development implementation

The development implementation follows the same architectural chain established by M2:

```text
CalendarScreen
  → CalendarService
  → CalendarRepository
  → CalendarApiRepository
  → CalendarApi
  → HttpTransport
  → development in-memory HTTP handler
```

The development handler is an in-memory simulation of the API boundary.

It is not production persistence and does not represent a production backend.

## Explicitly outside M3.0

The following capabilities are explicitly outside this ADR:

* full Order domain
* Order lifecycle
* payments
* commissions
* taxes
* cleaning supplies
* evidence storage
* dispute workflows
* emergency workflows
* notifications
* recurring calendar events
* external calendar integrations
* travel-time calculation
* automatic availability calculation
* drag-and-drop scheduling
* marketplace functionality
* staking
* application tokens
* Web3 wallet functionality
* production Firebase integration
* production backend implementation

## Architectural boundaries

M3 follows the existing dependency direction:

```text
CalendarScreen
  → CalendarService
  → CalendarRepository
  → CalendarApiRepository
  → CalendarApi
  → HttpTransport
  → future backend

AccessTokenProvider
  → HttpTransport
```

No reverse dependency is introduced.

Calendar Domain does not depend on infrastructure. Calendar Application does not depend on HTTP. Calendar UI does not construct API requests directly. Authentication provider details do not enter Calendar Domain/Application.

## Test implications

The M3 implementation should cover:

* `CalendarEntry` validation
* `startAt < endAt`
* half-open interval semantics
* supported entry types
* CalendarService use cases
* repository contract behavior
* DTO/domain mapping
* API error mapping
* authenticated transport behavior
* development composition
* UI loading, empty and error states
* entry rendering
* create, update and delete flows

The complete repository verification remains:

```text
TypeScript
ESLint
Jest
Android debug build
Android release build
git diff --check
GitHub Actions
```

## Consequences

### Positive

* Calendar remains independent from the future Order domain.
* M3 follows the architecture established by M1/M2.
* Application behavior can be tested without a real backend.
* A future backend can implement the established API contract without changing Calendar Domain/Application boundaries.
* Absolute timestamps avoid ambiguous persisted local-time semantics.
* `/me` endpoints keep ownership resolution on the authenticated server context.

### Trade-offs

* The initial Calendar model is intentionally abstract and may require additional decisions as scheduling requirements grow.
* Timezone handling requires careful conversion at the UI boundary.
* Future scheduling features may require additional domain concepts.
* Keeping Calendar separate from Order introduces an intentional mapping boundary for future order-linked entries.

## Status

This ADR approves the M3.0 Calendar model, time semantics, architectural boundaries, and initial API contract.

This ADR does not authorize implementation, backend development, commit, push, pull request, or merge.
