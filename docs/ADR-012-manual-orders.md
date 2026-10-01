# ADR-012 — ManualOrder and CalendarEntry Relationship

* **Status:** Accepted
* **Scope:** M4 — Manual Orders
* **Decision date:** 2026-10-01
* **Depends on:** ADR-007, ADR-010, ADR-011

## Context

M4 adds manual entry of an external cleaning order to the existing authenticated mobile application. M3 established CalendarEntry as an independent scheduling boundary. ManualOrder must not become a CalendarEntry, and scheduling fields must not be duplicated between the two entities.

The current app has provider-independent repository/service boundaries and a development in-memory HTTP composition. No production backend or persistent database is implemented.

## Decision

### 1. Separate domain entities

ManualOrder represents the work and the external customer snapshot. Its fields are:

* `id: string` — server/development-handler assigned.
* `customerName: string`.
* `serviceDescription: string`.
* `serviceAddress: string`.
* `calendarEntryId: string` — reference to the associated CalendarEntry.
* `createdAt: string` — server/development-handler assigned.
* `customerPhone: string | null`.
* `quotedPrice: { amountMinor: number; currencyCode: string } | null`.
* `notes: string | null`.

ManualOrder has no `startAt`, `endAt`, `userId`, or Order status. The client does not supply `id`, `createdAt`, `userId`, or status. Required text values must be non-empty after trimming. An optional quoted price has a non-negative safe integer `amountMinor` and a three-letter uppercase `currencyCode`; the M4 UI accepts RUB only.

CalendarEntry remains unchanged as the scheduling entity. It owns `startAt`, `endAt`, `type`, `status`, and `title`; its existing UTC ISO-8601 and half-open interval semantics remain defined by [ADR-011](ADR-011-calendar.md). A ManualOrder must reference an existing CalendarEntry, and while the ManualOrder exists that entry cannot be deleted. A delete attempt returns HTTP `409` with the existing safe `CALENDAR_CONFLICT` envelope; it does not cascade-delete the ManualOrder. Unlinked CalendarEntry deletion retains its existing behavior. M4 does not add `orderId` to CalendarEntry.

### 2. Scheduled creation orchestration

`CreateScheduledManualOrder` uses the existing application services:

```text
CreateScheduledManualOrder
  → CalendarService.createEntry(type=external_order, title=serviceDescription)
  → ManualOrderService.create(calendarEntryId=createdEntry.id)
```

If Calendar creation fails, ManualOrder creation is not attempted. If ManualOrder creation fails after Calendar creation, the use case attempts to delete the newly created CalendarEntry and rethrows the original error. If compensation also fails, it returns the safe code `ScheduledOrderCompensationFailed`.

This is application-level compensation for the current development composition. It is not an atomic transaction and cannot guarantee cleanup if compensation itself fails. A production backend transaction or equivalent reliable orchestration is deferred.

### 3. API boundaries

ManualOrder uses the authenticated current-user resource:

```text
GET  /v1/me/manual-orders
POST /v1/me/manual-orders
GET  /v1/me/manual-orders/{orderId}
```

Collection and item responses use `{ "orders": [...] }` and `{ "order": {...} }`. The client create body contains order details and `calendarEntryId`, but excludes `id`, `createdAt`, `userId`, status, `startAt`, and `endAt`. The client resolves ownership through the authenticated `/me` context, not a client-supplied identity.

Calendar adds only the read-by-id endpoint:

```text
GET /v1/me/calendar/entries/{entryId}
```

CalendarEntry is then loaded by ManualOrder Details using the saved reference. Existing Calendar model, types, statuses, and time semantics do not change; M4 adds only the linked-entry deletion guard described above.

### 4. Development implementation and scope

ManualOrder and Calendar use separate in-memory development HTTP handlers through the existing HttpTransport. The development router explicitly routes the ManualOrder resource and shares only the in-memory Calendar ID/reference check needed to enforce the required relationship. Data is not persistent and resets when the development composition is recreated. No production backend, database, Firebase, third-party storage, payment, Order status lifecycle, cancel, hard delete, or edit endpoint is introduced by M4.

## Consequences

* Calendar is the single owner of appointment times and Calendar status.
* The development composition rejects ManualOrder creation for a missing CalendarEntry and rejects CalendarEntry deletion while an order references it.
* Order Details composes ManualOrder data with its referenced CalendarEntry.
* Calendar does not navigate to Order Details in M4 and does not store an `orderId`.
* Client-level compensation can fail and is not a substitute for future transactional backend behavior.
* Production ManualOrder persistence, server authorization/ownership, and integration testing remain open work.
