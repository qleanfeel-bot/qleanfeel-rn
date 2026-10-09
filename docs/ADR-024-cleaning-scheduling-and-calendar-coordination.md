# ADR-024 — Cleaning Scheduling and Calendar Coordination

- **Status:** Accepted implementation decision; M7-B.8 implementation merged to `main`
- **Date:** 2026-10-08
- **Scope:** Owner-authorized scheduling and rescheduling of a Cleaning through Calendar
- **Related:** [ADR-020](ADR-020-authorization-foundation.md), [ADR-021](ADR-021-canonical-order-creation-and-optional-scheduling.md), [ADR-023](ADR-023-cleaning-execution-lifecycle.md), [Architecture Map](ARCHITECTURE_MAP.md)

## Context

The canonical relationship remains `Order → 0..N Cleaning → 0..1 CalendarEntry`. Order owns order facts, Cleaning owns execution facts and its current CalendarEntry reference, and Calendar owns CalendarEntry plus all schedule facts. A Calendar status is not evidence that Cleaning work was performed. M7-B.4 already creates an optional initial CalendarEntry in the same transaction as a manual Order and its initial Cleaning.

M7-B.8 adds scheduling for an existing Cleaning and rescheduling of its current CalendarEntry. The operations must coordinate both records without merging their ownership or execution/scheduling lifecycles.

## Decision

### ScheduleCleaning

`POST /v1/me/cleanings/:id/schedule` accepts a UTC `schedule` (`startAt`, `endAt`) and `expectedCleaningVersion`. It is allowed only for an owned Cleaning with `status=planned` and no `calendarEntryId`. The Calendar capability creates an `external_order`, `scheduled` CalendarEntry owned by the Order owner, with `version=1`. The Cleaning relationship is then set and Cleaning.version increments once. The new CalendarEntry and the version-checked Cleaning update commit in one UnitOfWork transaction.

### RescheduleCleaning

`POST /v1/me/cleanings/:id/reschedule` accepts the new UTC interval, `expectedCleaningVersion`, and `expectedCalendarEntryVersion`. It is allowed only for an owned, planned Cleaning with a current CalendarEntry whose Calendar status is `scheduled`. A missing entry, stale version, or non-scheduled Calendar state conflicts with `409`.

Rescheduling updates the existing CalendarEntry in place. Its ID is preserved and its version increments once. Its interval and `updatedAt` change. Cleaning, including `calendarEntryId`, `updatedAt`, and version, is unchanged. The response is the canonical Cleaning representation only.

### Ownership and concurrency

Both commands resolve `Cleaning → Order → createdByUserId` inside the application operation, then pass those facts to the existing pure Cleaning lifecycle ownership policy. Missing and non-owned Cleaning resources both return `404`; authentication and suspended-account behavior remain at the existing guard boundary.

The existing UnitOfWork encloses every write. Cleaning command queries lock the selected Cleaning row with PostgreSQL `FOR UPDATE`; lifecycle transitions retain their compare-and-set version update. Scheduling commands use the same row lock, so an execution transition cannot change the Cleaning state between the scheduling precondition check and commit. Schedule also compare-and-sets Cleaning by ID, `planned` status, null relationship, and expected version. Reschedule verifies the expected Cleaning version while holding that lock, then Calendar locks its entry and updates only when its ID, `scheduled` status, and expected Calendar version still match. Stale or invalid command preconditions return `409`.

The request versions are explicit concurrency preconditions. Schedule increments Cleaning.version and starts CalendarEntry.version at 1. Reschedule does not increment Cleaning.version; it increments CalendarEntry.version only. Timestamps remain metadata and are not concurrency tokens.

### History and ownership boundaries

Cleaning lifecycle history continues to record execution transitions only. Scheduling and rescheduling do not append events: Calendar owns schedule changes and the Cleaning lifecycle event table is not a generic audit log. Current Cleaning status remains canonical and independent of Calendar status. No schedule interval is copied onto Cleaning; CalendarEntry gains no `cleaningId`.

### CreateManualOrder compatibility

`CreateManualOrder` keeps its current optional initial-schedule behavior and remains one UnitOfWork. It uses the existing Calendar schedule capability. M7-B.8 adds the same Calendar-owned creation capability for an existing Cleaning and a narrow in-place reschedule operation; the HTTP endpoint is not called internally. Existing unscheduled initial Cleanings remain at version 1 until later `ScheduleCleaning` associates a CalendarEntry and increments the Cleaning version.

### Interval and overlap policy

Schedule intervals use the existing strict ISO-8601 UTC millisecond representation and require `startAt < endAt`. Invalid intervals return `400`. Calendar overlap, availability, and multi-cleaner conflict rules remain deferred product policy; these commands do not inspect other entries or add a database exclusion constraint.

No schema migration is required. Existing `cleanings.calendar_entry_id`, Cleaning and CalendarEntry versions, and the unique CalendarEntry relationship are sufficient.

## Non-goals

This decision does not add generic Calendar CRUD, recurring schedules, availability or overlap policy, matching or assignment, Order cancellation, reopening terminal states, customer confirmation or WorkAcceptance, notifications, reminders, GPS, evidence, disputes, Money, payments, Ledger, settlement, Web3, Dashboard, mobile integration, generic audit/history/scheduling frameworks, event sourcing, CQRS, an event bus, outbox, Kafka, RabbitMQ, Redis, cache, separate read database, or a new concurrency framework.
