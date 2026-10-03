# ADR-014: Canonical Order and Work Execution

- **Status:** Accepted architecture — implementation deferred
- **Date:** 2026-10-02
- **Scope:** Future business model; no M1–M5 implementation or contract changes
- **Related:** [M6 architecture proposal](M6_ARCHITECTURE_PROPOSAL.md), [Domain/Data Dictionary](DOMAIN_DATA_DICTIONARY.md)

## Context

M4 currently models `ManualOrder` as a separate entity that must reference a `CalendarEntry`. M3 Calendar owns scheduled intervals. There is no canonical `Order`, customer identity, or execution entity. A separate ManualOrder production model would make later client- and Qleanfeel-originated work diverge.

## Decision

Use one future canonical `Order` model for `manual`, `qleanfeel`, and `client` origins. `ManualOrder` remains only the current M4 compatibility/creation path; future standalone cleaner workflows create `Order(origin=manual)`. Keep `origin`, `createdBy`, customer, and optional assigned cleaner distinct. Store a guest customer's order-time snapshot; optionally reference a registered User without replacing the historical snapshot. Do not introduce a separate Customer aggregate until its lifecycle requires one. A mandatory managing account or contracting-party field is not part of the core Order model; marketplace and legal/commercial context can be added at those boundaries later.

Keep `Order != CalendarEntry != Cleaning`. Order records requested/agreed work and terms; CalendarEntry represents current scheduled/unavailable time; Cleaning owns execution and is the source of truth for whether work happened. An Order may be unscheduled and may have zero or more Cleanings, including recurring occurrences such as weekly cleaning. `Cleaning.orderId` is the primary relationship; do not add mutable `Order.cleaningIds`. A CalendarEntry may exist without an Order or Cleaning. Personal and blocked entries remain Calendar-only. A Cleaning may reference at most one active CalendarEntry through `calendarEntryId`.

The standalone cleaner flow is `Cleaner → Order(origin=manual, status=confirmed) → Cleaning → CalendarEntry → CleaningStarted / CleaningCompleted → optional FinancialEvent/Ledger`. Manual creation is immediately `confirmed`; `draft` remains for more complex future workflows. Cleaning lifecycle events are first-class business facts. CalendarEntry represents the current Cleaning schedule; rescheduling updates that same entry, and cancelling Cleaning does not delete the historical entry (it may become `cancelled`). Scheduling history is not part of the current model. Calendar's current `completed` state is not evidence that work occurred.

Proposed core Order states: `draft → confirmed → cancelled | partially_fulfilled | fulfilled`. Marketplace offer/routing concepts such as `awaiting_customer`, `awaiting_cleaner`, `declined`, and `expired` belong to a future offer layer and are not required for standalone cleaner operation. Proposed Cleaning states: `planned`, `in_progress`, `completed`, `partially_completed`, `not_performed`, `cancelled`. Corrections to completed facts require an audited correction path.

The future `/manual-orders` compatibility boundary may adapt to the canonical Order store, but must not create a second production aggregate. Existing M4 model, UI, and API contract remain unchanged until a separately approved migration.

## Consequences

- An explicit migration is needed because current M4 requires `calendarEntryId`, uses `quotedPrice`, and lacks canonical origin/lifecycle fields. M4 stays unchanged during M6.
- A future offer/routing layer may add marketplace-specific states without changing the standalone core Order lifecycle.
- `Cleaning` owns its `orderId`; reverse Order-to-Cleaning lists are query/read-model projections, not a mutable `Order.cleaningIds` field.
- A recurring Order is represented by multiple Cleaning occurrences; each Cleaning has at most one current CalendarEntry.

## Remaining design details

Detailed event payloads and any future audit/history model remain implementation/design follow-ups. Marketplace offer-layer behavior remains a separate future design; it does not extend the standalone core lifecycle by default. The approved core lifecycle and current schedule relationship are recorded above.
