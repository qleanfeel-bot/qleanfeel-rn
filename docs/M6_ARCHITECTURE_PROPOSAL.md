# M6 — Backend & Business Architecture Definition

- **Status:** Architecture approved; implementation deferred
- **Repository baseline:** `origin/main` at `59c2636989f5abea5b936c936c7308fb5db3b052` (M5 merge, PR #6)
- **Scope:** Domain and future backend/API architecture only. No backend, persistence, Firebase, UI, payment, messaging, evidence storage, or Web3 implementation is authorized by this proposal.
- **Related documents:** [Domain/Data Dictionary](DOMAIN_DATA_DICTIONARY.md), [ADR-014](ADR-014-canonical-order-and-work-execution.md), [ADR-015](ADR-015-money-ledger-and-geography.md), [ADR-016](ADR-016-business-modules-api-transactions-and-home.md), [ADR-017](ADR-017-messaging-evidence-and-settlement-boundaries.md)

> **M7 follow-up:** M6 remains the approved business-architecture baseline. M7-B.1 through M7-B.8 are implemented and merged to `main`, including the production backend foundation, identity/authentication, authorization boundary, canonical `CreateManualOrder`, Order retrieval, Cleaning execution lifecycle and reads, and Cleaning scheduling coordination. [ADR-021](ADR-021-canonical-order-creation-and-optional-scheduling.md) resolves the manual-create scope: every `CreateManualOrder` creates one initial planned Cleaning, while CalendarEntry remains optional; the global `Order 0..N Cleaning` cardinality is unchanged. This later decision also defines the active-account rule, atomic UnitOfWork, client-requested `schedule.startAt`/`schedule.endAt` versus server-authored metadata, and idempotency deferral. [ADR-024](ADR-024-cleaning-scheduling-and-calendar-coordination.md) records the later scheduling ownership/version/history boundary. These M7 decisions do not rewrite M6 history or alter M1–M5 contracts. [ADR-023](ADR-023-cleaning-execution-lifecycle.md) separates execution status from future WorkAcceptance and settlement. M7 implementation status does not imply deployment or production readiness.

## 1. Decision summary

This proposal adopts one canonical future `Order` model for manual, Qleanfeel-originated, and client-originated work. `ManualOrder` remains only the current M4 compatibility/creation path; future standalone cleaner workflows conceptually create `Order(origin=manual)` and do not introduce a parallel ManualOrder business model. Core Qleanfeel must remain useful to a cleaner without marketplace negotiation or a registered client. Marketplace creation/offer workflows are future layers around the same Order model.

The proposed relationship is:

```text
Cleaner creates Order(origin=manual, status=confirmed)
  └── 0..N Cleaning (recurring work may have multiple occurrences)
        └── 0..1 active CalendarEntry (current schedule only)
              ↓
       CleaningStarted / CleaningCompleted (first-class events)
              ↓
       optional FinancialEvent / Ledger

CalendarEntry may also exist without an Order or Cleaning.
An Order may exist before it is scheduled.
```

Keep these core facts distinct; marketplace/legal extensions may add context without becoming mandatory core Order fields:

| Concept | Meaning | Example |
| --- | --- | --- |
| `origin` | Immutable channel through which the Order entered the business | `manual`, `qleanfeel`, `client` |
| `createdBy` | Authenticated user or platform principal that issued the create command | Cleaner user, client user, Qleanfeel system principal |
| `customer` | Party buying/requesting the service; may be an external snapshot or a registered User | Guest contact or registered client |
| `assignedCleaner` | User assigned to perform the work, if assignment applies | May be absent before assignment; separate from creator |

Authorization derives from the authenticated principal and the applicable owner/participant relationship. A mandatory `managingAccount` field is not part of the first-order model. Contracting seller, agency, and other commercial/legal roles are future marketplace context and must not add complexity to a standalone manual Order.

Money uses integer minor units and a currency code. Money, FinancialEvent, and Ledger are future architectural boundaries and vocabulary; M6 does not settle accounting policy, revenue recognition, tax liability, chart of accounts, or ledger implementation. Home consumes a read-only application projection and does not invent business rules.

The backend starts as a **modular monolith** with business-owned modules and one transaction-capable persistence boundary. External payment or media providers are adapters. This matches the existing Architecture document's modular-monolith direction and avoids premature distributed transactions.

## 2. Actual M1-M5 repository audit

`origin/main` is `59c2636`, the merge of M5 PR #6. The clean M5 checkout at `df54e70` has no content diff from that remote main tree. The main branch contains 30 Jest suites / 276 tests as recorded by M5; this architecture audit did not run implementation tests.

### Current entities and state

| Current concept | Actual model and source of truth | Current limitations |
| --- | --- | --- |
| `User` | Internal `id`, `status` (`active`/`suspended`), `createdAt`, `updatedAt`; domain type exists | No roles, tenant/workspace, or production identity implementation |
| `AuthIdentity` | `id`, `userId`, provider (`firebase` only), `providerSubject`, creation and last-authenticated timestamps | Firebase adapter is not implemented; the enum is narrower than the provider-independent port framing |
| `AuthSession` | `id`, `userId`, status (`active`/`expired`/`revoked`), created/expiry/revocation times | Domain type exists, but active `AuthState` stores `User` only and the development auth composition does not restore a real session |
| `Profile` | `userId`, display name, optional contact/avatar/locale/country strings | Generic profile only; `country` has no code or legal-jurisdiction semantics; no `CleanerProfile` or Client profile exists |
| `CalendarEntry` | `id`, UTC `startAt`/`endAt`, type (`external_order`, `blocked`, `personal`), status (`scheduled`, `cancelled`, `completed`), title | Owns the interval and Calendar status. No order/customer/cleaning ID, timezone ID, country, or persistence. Current `completed` is not evidence that work occurred |
| `ManualOrder` | `id`, customer name/phone snapshot, service description/address, required `calendarEntryId`, `createdAt`, optional `quotedPrice`, notes | No `source`, creator, owner/manager, registered customer ID, assignment, status, agreement price, or execution lifecycle. It cannot be unscheduled |
| `Home` | No Home domain entity. `HomeScreen` calls Profile, Calendar and ManualOrder services, computes today's UTC-range overlap results in presentation, and maps `calendarEntryId` to ManualOrder | M5's small work-list projection is presentation code; it has no Money data or business accounting logic |

No `Order`, `Customer`, `Cleaning`, `CleanerProfile`, `Money`, `FinancialEvent`, `LedgerEntry`, `Expense`, `Payout`, `Evidence`, `Conversation`, `Dispute`, or `Settlement` model exists in M1-M5. Navigation route state is not domain state.

### Current application/API/development boundaries

Current mobile chain is `Presentation → Application service → Domain repository port → Infrastructure API repository → DTO mapper/API → HttpTransport`. Domain types are provider/UI/HTTP independent. Current resources are:

| Current API | Current status |
| --- | --- |
| `GET/PATCH /v1/me/profile` | Implemented client contract; PATCH changes only `displayName` |
| `GET/POST /v1/me/calendar/entries` | Implemented client contract; list requires UTC `from` and `to` |
| `GET/PATCH/DELETE /v1/me/calendar/entries/{entryId}` | Implemented client contract; M4 blocks deletion while referenced by a ManualOrder |
| `GET/POST /v1/me/manual-orders` | Implemented client contract for M4; list/create collection and create body require `calendarEntryId` |
| `GET /v1/me/manual-orders/{orderId}` | Implemented client contract |
| `POST /v1/auth/bootstrap`, `GET /v1/me` | Auth ports describe planned operations; no production HTTP backend exists |

These are client contracts, not evidence of deployed production APIs. `createDevelopmentComposition` wires Profile, Calendar and ManualOrder repositories through `HttpTransport` into process-local in-memory handlers, using a fixed development token. The auth preview also uses a hard-coded in-memory user/credential. Restarting the composition loses data. Development handlers do not supply production identity resolution, authorization, persistence, transactions, pagination, or durable idempotency.

`CreateScheduledManualOrder` currently creates CalendarEntry, then ManualOrder, and tries to delete CalendarEntry if ManualOrder creation fails. This is best-effort development compensation, not atomic production consistency. It must not be copied as the production transaction design.

### Architectural conflicts that M6 resolves conceptually

| Existing M1-M5 fact | Proposed future resolution | Compatibility rule |
| --- | --- | --- |
| `ManualOrder` is a separate entity and `/manual-orders` is its API resource | Canonical Order aggregate has immutable `origin=manual`; no separate production ManualOrder table | Keep current M4 code/contracts unchanged during M6. A later approved API adapter maps `/manual-orders` to Order and does not write duplicate records |
| Every ManualOrder requires one CalendarEntry | Order may be unscheduled; execution occurrences are separate Cleanings; scheduled Cleaning refers to its current CalendarEntry | Existing M4 paired creation remains untouched. Production Order + optional Cleaning + Calendar creation is one backend command/transaction |
| CalendarEntry status includes `completed` | Keep it as Calendar block closure only; it never proves service completion | Cleaning completion is the work-performed fact. Any later status/API change requires a migration ADR |
| M4 `quotedPrice.amountMinor` is a JS number and M4 UI assumes two decimals/RUB | Canonical Money uses exact integer minor units with currency-specific scale; quotes and agreed prices are distinct | Do not change M4 model now. Future DTO/domain migration must handle historic RUB amounts explicitly |
| Profile has nullable free-form `country` | Clarify it as profile/home context, not service jurisdiction or tax authority | Do not silently reinterpret stored data; normalize only through approved migration |
| M5 Home joins data and filters/sorts today's scheduled ManualOrders in UI | Add Dashboard/Home application projection sourced from domains/read models | M5 Home stays unchanged; no financial calculations are added to it |
| No production authorization, database, transactions, cursors, or idempotency | Put authorization, atomic writes, and durable command idempotency at backend business boundaries | Client checks and process-local fakes remain preview/test tools only |

## 3. Canonical Order proposal

`Order` is the one durable business model for every source. `origin` is immutable: `manual`, `qleanfeel`, or `client` (new origins are explicit additions). `createdBy` is immutable. Customer reference, optional cleaner assignment, and service terms remain distinct. Managing account and contracting party are not mandatory core fields; resource authorization and future commercial/legal context are handled at their appropriate boundaries.

Proposed Order data:

- server-assigned opaque `orderId`, `createdAt`, `updatedAt`, and optimistic-concurrency `version`;
- immutable `origin` and `createdBy` principal;
- `customer`: optional registered `customerUserId` plus required order-time contact snapshot (name and captured contact fields as authorized);
- optional `assignedCleanerUserId` when the work is assigned; assignment is separate from origin/creator;
- `serviceSnapshot`: service description, agreed scope, and service-address snapshot; it is not a live Profile reference. Any future jurisdiction/commercial context is outside the core Order model;
- versioned `priceTerms`: quotes and accepted terms are distinct immutable snapshots; `agreedPrice` is absent until terms are accepted/attested;
- persisted Order lifecycle state plus append-only transition history;
- Cleaning records refer to `orderId`; reverse Order-to-Cleaning lists are query/read-model projections, not a mutable `Order.cleaningIds` aggregate field. Order stores no Calendar times or financial totals.

### Source, owner, customer and cleaner

- **Cleaner standalone today/future:** origin is `manual`; the authenticated cleaner creates and operates the Order; external customer snapshot is sufficient; no marketplace account or negotiation state is required. Manual creation immediately creates a `confirmed` Order. `draft` remains available for more complex future workflows. M4's current ManualOrder path remains unchanged during M6.
- **Qleanfeel later:** origin is `qleanfeel`; it is still a canonical Order. A Cleaning must exist before that work is represented on the Calendar; its CalendarEntry represents the Cleaning's current schedule, not the Order itself. Any offer/assignment workflow remains a separate future layer.
- **Client later:** origin is `client`; authenticated Client is creator and customer. Client-created work converges on the same Order model; any offer/routing workflow remains a separate future layer and does not force marketplace negotiation onto standalone manual Orders.

`Customer` is an Order party, not initially an independent Customer aggregate. For an unregistered customer, Order stores a contact snapshot. A registered Client is represented by `customerUserId` referencing Qleanfeel `User`, with an order-time snapshot retained. Linking later requires identity verification/consent and writes an audit event; it never replaces historical name/contact snapshots or silently merges records by matching phone/name. A Client can have generic Profile and a client capability/role without a new Customer table. A Cleaner role is similarly a server-authorized capability; business operating settings belong to a proposed optional `CleanerProfile`, not to AuthIdentity.

The authenticated principal and resource relationship determine authorization. `/me` means “the authenticated principal's authorized view,” not “all rows whose client-supplied userId matches.” Creator, customer, and assigned cleaner may differ; future marketplace/legal roles are added only where that product workflow requires them.

### Order terms and change history

`quotedPrice` is an estimate. `agreedPrice` is a price recorded with the agreed service scope; it is not proof of payment, earnings, revenue, tax, or balance. Preserve the agreed terms if changed, but the amendment/version mechanism remains for later design. Marketplace fees, tax inclusion, and legal seller context are not mandatory core Order fields.

The future Order may describe one or more service scopes; a separate Service catalogue is not required now. Detailed line allocation, amendment mechanics, and commercial calculations remain future decisions. `serviceDescription` can remain an Order snapshot, optionally associated with a catalogue if one is later needed.

## 4. Order, CalendarEntry and Cleaning

- **Order:** work a cleaner records or parties agree to, its customer context and service terms.
- **Cleaning:** one planned/actual work execution occurrence under an Order. One Order may have zero or many Cleanings; multiple Cleanings support recurring work such as weekly cleaning. `Cleaning.orderId` is the primary relationship. Cleaning owns the execution lifecycle and is the source of truth for whether that occurrence happened.
- **CalendarEntry:** the current schedule of a Cleaning or a standalone availability block. It owns the UTC time interval, not the truth of whether work happened. `blocked` and `personal` entries remain standalone; current M3 scheduling behavior remains valid. A CalendarEntry may exist without an Order or Cleaning, and an Order may exist before it is scheduled.

For the current product, a Cleaning has at most one active `CalendarEntry`, referenced by optional `Cleaning.calendarEntryId`. A Qleanfeel-originated Order is still an Order; its Calendar representation exists only after a Cleaning exists and has a schedule. Do not turn CalendarEntry into an Order or use it as the source of Qleanfeel Orders.

Rescheduling updates the existing CalendarEntry for the same Cleaning; it does not create a new Cleaning. Cancelling a Cleaning does not delete its CalendarEntry; the entry may become `cancelled`. Scheduling history is not part of the current model. Future audit/event history may be added separately. M4's `ManualOrder.calendarEntryId` remains the current compatibility shape until a later migration.

Cancellation before work starts cancels the Order and outstanding planned Cleanings/CalendarEntries consistently. After work starts/completes, preserve completed work and close remaining work through explicit cancellation/partial-fulfillment transitions. Any fee/refund consequence requires a separately designed policy. Partial completion is recorded as an explicit work outcome; no time-only price proration is implied.

Cleaning lifecycle events are first-class business facts, including `CleaningStarted`, `CleaningCompleted`, and `CleaningPartiallyCompleted`; each identifies the Cleaning and records the actor and event time. Cleaning remains the source of truth for its execution lifecycle. CalendarEntry status describes the schedule block only and never proves the Cleaning happened. Notifications are downstream delivery mechanisms for business events, not business state. A future Client App may consume authorized Order/Cleaning read models and notification events, but it must not own or calculate authoritative business state. Progress and estimated remaining time are future derived estimates, not authoritative facts.

## 5. Lifecycles and transitions

### Order lifecycle

| State | Meaning | Allowed next states / actor | Terminal / business effect |
| --- | --- | --- | --- |
| `draft` | Future unconfirmed Order state for more complex workflows | `confirmed`, `cancelled`; authorized workflow actor | Not terminal; not required by standalone manual creation |
| `confirmed` | Work recorded by the cleaner as agreed, or agreed through a future workflow; may be unscheduled or not started | `cancelled` before work starts; `fulfilled` when required work is complete; `partially_fulfilled` after some work and explicit closure of the remainder; standalone cleaner or authorized actor in a future workflow | Manual creation starts here; not a payment or completion status |
| `cancelled` | Entire order canceled before work started | None; correction requires audited replacement/reinstatement command | Terminal; any cancellation fee/refund is a separate financial event |
| `fulfilled` | All committed scope has accepted completed Cleaning outcomes | None; correction is a compensating event/claim, not reopening | Terminal operational state; payment may still be pending/unpaid |
| `partially_fulfilled` | Some scope was completed and remaining scope explicitly waived/canceled | None; correction is a compensating event/claim | Terminal operational state; partial earnings/refund require explicit Money policies |

Manual Order creation immediately creates a `confirmed` Order. `draft` remains available for more complex future workflows. Confirmation does not mean work started or money paid; current M4 remains a compatibility path and is unchanged.

### Cleaning lifecycle

| State | Meaning | Allowed transitions / actor | Terminal / event |
| --- | --- | --- | --- |
| `planned` | Work occurrence exists; may be unscheduled or linked to its current CalendarEntry | `in_progress`, `cancelled`, `not_performed`; assigned cleaner or authorized actor | No work or financial fact implied |
| `in_progress` | Performer has recorded actual start | `completed`, `partially_completed`, `not_performed`; assigned cleaner/authorized operations | `CleaningStarted` is a first-class business fact |
| `completed` | Agreed scope for this occurrence was performed | None; correction requires audited correction/dispute | `CleaningCompleted` is a first-class work fact |
| `partially_completed` | Some explicit scope/quantity was done, not all | None; remaining work is a new/rescheduled Cleaning or explicit Order amendment | `CleaningPartiallyCompleted`; no automatic time-based proration |
| `not_performed` | This occurrence did not happen | None; replacement requires a new planned occurrence | No completion earnings; cancellation/no-show rules may create separate fees |
| `cancelled` | Planned occurrence was removed before work | None | Terminal; schedule cancellation is separately recorded |

Completion actor, work occurrence, `occurredAt`, server `recordedAt`, actual outcome and optional customer confirmation are stored separately. Customer confirmation or Evidence may corroborate completion but is not required to define the cleaner's completion assertion.

### Calendar lifecycle

Current M3 states and standalone CalendarEntry behavior stay unchanged. CalendarEntry describes the current scheduled interval or standalone availability block. Reschedule updates the same active CalendarEntry; cancellation may mark it `cancelled` without deleting it. Scheduling history is not part of the current model. Calendar `completed` means the Calendar block was closed; it is not a Cleaning completion or an Order/financial state.

### Payment, financial-event and settlement lifecycle

Order, Calendar, Cleaning and Payment are separate state machines. Future external `PaymentAttempt`/`Payout`/`Settlement` states are `created → pending → succeeded | failed | cancelled`, with partial/full refunds represented by additional refund records/events, not by rewriting the original successful payment. Provider callbacks are authenticated, deduplicated and reconciled. A successful payment/payout is an external cash-movement fact; it is not the Order's completion state.

FinancialEvent and Ledger are future boundaries for recording economic/accounting facts. M6 does not define their posting rules, accounting semantics, reversal model, chart of accounts, or journal transaction design. An Order transition or quote must not be assumed to create a financial fact.

## 6. Money and financial boundaries

Keep the vocabulary distinct without treating M6 as an accounting policy:

| Term | Boundary meaning | M6 decision status |
| --- | --- | --- |
| **Quoted price** | An estimate or offer amount | Separate from accepted terms; exact lifecycle is future Order design |
| **Agreed price** | Amount recorded as part of the accepted Order terms | Order fact; does not itself establish payment, earnings, revenue, or balance |
| **Gross amount / customer amount** | Customer-facing amount associated with agreed terms or a later transaction | Components and calculation rules require future commercial/payment design |
| **Cleaner earnings** | A future measure of value attributed to cleaner work | Formula, recognition point, and source require financial-policy review |
| **Platform fee** | A possible commercial fee in a future marketplace arrangement | Not required for standalone cleaner Orders; terms and accounting treatment are future decisions |
| **Tax** | A future legal/accounting amount or obligation | Seller, jurisdiction, taxability, rates, collection, and liability treatment are unresolved |
| **Expense** | A possible cleaner business cost | Recording, payment, tax, and reporting treatment are future product/accounting decisions |
| **Tip / discount / refund / adjustment** | Distinct possible commercial or financial events | Semantics and posting effects are future decisions; do not fold them into Order price without explicit terms |
| **Paid amount** | Amount established by a payment outcome | Payment provider/source and refund treatment are future decisions |
| **Revenue / net income** | Accounting/reporting terms | Definitions, recognition, and calculations are not selected by M6 |
| **Payout / available balance** | Potential transfer and funds-availability concepts | Relevant only if the product tracks/controls funds; lifecycle and calculation are unresolved |

The standalone cleaner may record an agreed price without using Qleanfeel to collect or hold funds. Order price must not be labeled earnings, paid amount, revenue, payout, or available balance without a separately approved definition and source.

### Money value boundary

Proposed canonical value:

```text
Money {
  amountMinor: integer
  currencyCode: string
}
```

The canonical amount is an exact integer in minor units paired with a currency code; binary floating-point is not the canonical representation. This preserves the existing M4 quote as a legacy client contract while leaving supported codes, precision registry/versioning, JSON representation, persistence type, conversion, arithmetic, and rounding for implementation review. No universal two-decimal assumption or rounding mode is adopted by M6.

### FinancialEvent and Ledger boundaries

`FinancialEvent` is a future boundary/vocabulary for representing a business event with a possible economic effect. `Ledger` is a future boundary/vocabulary for financial records and projections. M6 does not decide whether the ledger is the sole accounting source of truth, whether entries are double-entry or immutable, how corrections work, which events create postings, how earnings/revenue/balance are derived, or what chart of accounts applies. Completion may be followed by an optional FinancialEvent/Ledger flow only after those policies are approved. Quotes and Order status must not be treated as financial facts by assumption.

## 7. Country, currency, timezone and tax context

- Current `Profile.country` is an unvalidated optional profile field. It is profile context only and must not be treated as tax truth, tax residence, seller registration, or service jurisdiction.
- Service location, cleaner country, customer residence, timezone, currency, and any future tax context are distinct inputs with ownership and semantics to be designed before relevant implementation. M6 selects no tax resolver, legal seller, rates, regimes, tax liability treatment, or historical tax snapshot schema.
- Keep absolute schedule instants in UTC and use an IANA timezone identifier when local-time interpretation is needed. The exact local-time snapshot and timezone ownership are future Calendar/API design decisions. [IANA timezone database](https://www.iana.org/time-zones/theory).
- Multi-country support requires later product/legal/accounting decisions; do not add tax behavior to Profile, Order UI, or Home.

## 8. Stored facts and projections

| Value | Classification | Authoritative source / derivation |
| --- | --- | --- |
| Order source, creator, customer snapshot, accepted scope/price/currency | Stored, versioned facts | Order/Order amendment history |
| Current Order owner/assignment/status | Stored Order facts and lifecycle | Orders domain and authenticated resource authorization; no mandatory managing-account field |
| Calendar start/end UTC and timezone context | Stored current schedule facts | CalendarEntry referenced by Cleaning; schedule history is not in the current model |
| Cleaning actual start/completion time/outcome/actor | Stored immutable event facts plus current state projection | Cleaning module events |
| Quoted and agreed price | Stored separate immutable versions | Order terms; neither alone is earnings or cash |
| FinancialEvent and Ledger data | Potential stored financial facts, if adopted | Future Money boundary; event/posting semantics and source of truth remain undecided |
| Paid amount, earnings, revenue, expenses, net income, available balance | Candidate derived values or explicit external/business facts depending on definition | Each requires a future source, formula, accounting basis, currency and lifecycle decision; M6 does not prescribe calculations |
| Home schedule/pending-action/money cards | Read-only projection candidates | Calendar, Order, Cleaning; optional future Money source; response can carry `asOf`, timezone, currency and source references once defined |
| Evidence/Conversation/Dispute facts | Stored in their own future domains | Their domain owns state; they reference Order/Cleaning IDs instead of embedding arrays |

M6 does not select a revenue-recognition basis or accounting standard. Any future use of terms such as revenue, earnings, expense, or balance requires an explicit market/business definition before implementation.

## 9. Future backend business modules

| Module | Responsibility and owned concepts | Operations / dependencies / auth boundary |
| --- | --- | --- |
| Identity & Access | User, AuthIdentity, Qleanfeel sessions, capabilities/roles | Verify provider credentials and resolve `/me`; all business modules consume trusted principal and authorize resources. Provider adapters do not own business roles |
| Profile | Generic Profile and optional CleanerProfile | Read/update self profile and cleaner operating settings; no order, tax-event, or balance writes |
| Calendar | CalendarEntry intervals, availability conflicts and timezone-aware schedule operations | List/create/update/cancel/reschedule; may validate a Cleaning reference by application command; owns no Order/price/work completion |
| Orders | Canonical Order, customer snapshot/reference, terms, source, core lifecycle | Create/update/confirm/cancel; standalone cleaner use is supported. A future marketplace offer/routing layer may reference Orders without adding negotiation states to core Order |
| Cleaning | Cleaning execution occurrences, assignments, start/completion/partial/no-show facts | Plan/start/complete/partially-complete/cancel; references Order and Calendar; emits immutable business events; cannot alter accepted price or Ledger directly |
| Money / Financial boundaries | Money, FinancialEvent, and Ledger concepts; exact eventual scope undecided | Define financial facts and projections only after separate accounting/product review; no chart of accounts, tax rules, revenue-recognition rules, or posting workflow is approved by M6 |
| Dashboard / Projections | Read-only Home/dashboard projection | Compose Calendar, Orders, Cleaning and optional future Money data; no writes or business decisions; response authorization and time/currency context are defined with implementation |
| Messaging (future) | Conversation, participants, immutable Messages, delivery/read receipts | Independently create/send/list/close conversations; references users and optional business context; has per-participant access policy, not Order-owned message arrays |
| Evidence (future) | Evidence metadata, provenance and access policy; binary object-store references only | Register/list/revoke/tombstone Evidence for authorized context; verifies upload/download grants and retention/legal holds; no Order-owned photo array |
| Disputes (future) | Claim, participants, status, findings/decision | Open/review/resolve/withdraw claims related to Order/Cleaning; Evidence is linked; Money receives explicit refund/adjustment commands, not a direct dispute-side ledger mutation |
| Settlement adapters (future) | Payment provider, bank payout, and optional chain transfer attempts/reconciliation | External side effects outside DB transactions; idempotent request/callback handling; emit verified settlement facts to Money. Business Orders never depend on a provider or chain |

Initially these are business modules in one modular monolith, not separate services/databases. Each module owns its tables and writes; a transaction coordinator can use one database transaction without letting the caller bypass another module's rules. Cross-module reads use application contracts/read models; no UI repository writes directly to another module's tables.

## 10. Critical transaction boundaries

### Order creation and scheduling

The future standalone command creates `Order(origin=manual, status=confirmed)` for the authenticated cleaner. If scheduled, it creates a Cleaning with its current CalendarEntry; an Order may have multiple Cleanings for recurring work. Backend design must make the requested Order/Cleaning/schedule operation consistent so a schedule conflict cannot leave a misleading partial result; exact transaction and command boundaries remain implementation decisions. Rescheduling updates the current CalendarEntry rather than creating another Cleaning or schedule-history record. Independent personal/blocked CalendarEntry creation remains a Calendar operation.

Notifications and other downstream delivery occur after the business event is committed; delivery success/failure is not the business state. A modular monolith and one transaction-capable database are the M6 starting assumption. If modules later split storage, use durable process/saga state, idempotency, and compensating business transitions; never pretend distributed rollback or hard-delete a valid historical record.

### Cleaning completion and financial posting

Cleaning completion is an explicit work fact, separate from Calendar completion. A later financial design may associate an optional FinancialEvent/Ledger record with completion. M6 does not decide whether such a record is created, when it is recognized, or what transaction, idempotency, posting, or projection rules apply.

### Other future financial operations

Refund, expense, adjustment, payment, and payout concepts are outside M6 implementation and require dedicated business/accounting designs. Their transactions, authorization, provider reconciliation, idempotency, and ledger effects remain unresolved; the existence of Money/FinancialEvent/Ledger boundaries does not decide them.

## 11. API boundary proposal

### Existing contracts

Keep M1-M5 client contracts and DTO/domain separation unchanged during M6. `/v1/me/profile` remains self-profile. `/v1/me/calendar/entries` remains the scheduling API, with M6 timezone/cleaning-link additions requiring a later explicit versioned/compatible contract. `/v1/me/manual-orders` remains a development-era compatibility contract only; no production table is prescribed by its name. Auth ports' `/v1/auth/bootstrap` and `/v1/me` remain planned, not implemented.

Before connecting a released client to the production Order capability, prefer migrating it to the canonical `/v1/me/orders` resource. If a released client requires `/manual-orders`, keep a server adapter that creates/reads the same Order aggregate and translates fields; do not maintain a parallel ManualOrder collection. M4's current required-calendar create body cannot express unscheduled Order and its `quotedPrice` cannot be treated as `agreedPrice` without a deliberate migration.

A CalendarEntry is not an Order resource. A `qleanfeel` Order is represented on Calendar only after a Cleaning exists and has a current schedule; `blocked`, `personal`, and current standalone Calendar contracts remain valid.

### Proposed future resource families (not implemented)

The Money, ledger, expense, refund, and payout paths below are illustrative candidates only. Their resource names and behavior require a separate financial/API design review.

```text
GET/POST/PATCH /v1/me/orders[/{orderId}]
POST           /v1/me/orders/{orderId}/confirm|cancel
GET/POST       /v1/me/cleanings[/{cleaningId}]
POST           /v1/me/cleanings/{cleaningId}/start|complete|partially-complete
GET            /v1/me/dashboard
GET            /v1/me/money/summary
GET            /v1/me/ledger-entries
GET/POST       /v1/me/expenses[/{expenseId}]
POST           /v1/me/orders/{orderId}/refunds
GET/POST       /v1/me/payouts[/{payoutId}]
GET/POST       /v1/me/conversations[/{conversationId}/messages]   (future)
GET/POST       /v1/me/evidence[/{evidenceId}]                     (future metadata only)
```

Future marketplace offer, routing, decline, or expiry operations belong to a separate workflow layer and are not required to create or manage a standalone cleaner Order.

`/me` identifies the authenticated actor, not a globally trusted owner ID. The server derives `origin` and `createdBy` from the command and principal; clients cannot set another user's identity or permissions. Authorization follows the authenticated user and relevant resource/participant relationship; M6 does not require a separate managing-account field. Financial or provider-settled status, if later introduced, is not client-set business data.

Lists use opaque cursor pagination with stable sort (`createdAt,id` or time/id) and explicit filters; no unbounded order/ledger/message/evidence list. Write commands that create business resources or external effects accept a caller-scoped idempotency key with a durable uniqueness constraint and replay the original result. State-changing commands use a resource version/ETag or expected state to prevent stale overwrites. DTOs are versioned infrastructure contracts mapped to domain commands/entities. Keep current safe `{error:{code,message}}` semantics; use stable machine codes and distinguish validation (`400`), unauthenticated (`401`), forbidden (`403`), missing (`404`), state/uniqueness conflict (`409`), and safe unexpected/server/network failures. No endpoint in this section exists yet.

## 12. Home/Dashboard contract

`HomeScreen` currently displays today's schedule by joining CalendarEntry and ManualOrder and may fetch profile display name. That is a valid M5 presentation projection, not an M6 business API and not a Money source. Do not refactor it until a later approved implementation milestone.

Future presentation contract:

```text
HomeScreen → DashboardService / projection → Calendar + Orders + Cleaning + Money read models
```

The projection is read-only, permission-filtered, returns `asOf`, requested dashboard IANA timezone, and currency-separated values. It returns source IDs/deep-link references for actionable cards. Data requirements:

| Home value | Domain source and truth | Stored/derived and context |
| --- | --- | --- |
| Today's schedule | CalendarEntry; associated Order/Cleaning details | Derived by UTC instant range for explicit dashboard timezone; appointment labels also use service timezone |
| Today's orders | Orders lifecycle | Projection of authorized Orders plus scheduled Cleanings; do not infer `confirmed` from Calendar |
| Pending actions | Core Order and Cleaning tasks; optional future marketplace workflow | Read-only projection with source entity ID and authorization context |
| Earnings today/week/month | Optional future Money projection | Definition, source, period basis and calculation require separate financial-policy review |
| Available balance | Optional future funds projection | Only after product determines it tracks/controls funds and defines the source; no Home calculation |
| Expenses | Optional future business-cost projection | Lifecycle, accounting basis, tax handling and calculation require separate review |
| Alerts | Source module (Calendar/Order/Cleaning/Money/Dispute) | Projection only; the owner module decides truth and actions |

Any future Money cards must state their approved currency and period semantics; M6 does not select their formulas or response representation. Home remains a read-only projection and cannot invent financial truth.

## 13. Messaging, Evidence, Dispute and Web3 boundaries

- **Messaging:** future independent Messaging/Communication domain owns Conversation, participant membership and Messages. A Conversation may reference an Order, Cleaning, support case or no business object. Do not use `Order.messages[]`. Each Message is append-only; delivery/read state is transport/receipt data; retention/access are conversation policies.
- **Evidence:** future independent Evidence domain owns typed metadata/provenance and an opaque object-storage reference. Evidence kinds include photo, video, document, message reference, customer/cleaner confirmation, timestamp, location-related attestation, or system event. Fields include immutable creator/uploader, associated User, capture/occurred time (claim) versus server received time, content type/size, hash algorithm+digest, provenance/source, subject type/id, access policy, retention policy/version, legal hold and tombstone status. Evidence can reference Order, Cleaning, Dispute or other context; binary bytes are a future object-store responsibility. Metadata correction/revocation is audited, hashes are immutable, retention is jurisdiction/purpose based, and access requires case/participant authorization. Evidence supports but does not itself decide truth, dispute outcome, Cleaning completion, or a financial posting.
- **Dispute:** future independent Disputes boundary owns a claim, parties, subject references, status, evidence links, reviewer, decision/reason and timestamps. Its outcome requests an authorized operation from the owning Order or future financial boundary; it does not own or directly edit those domains' records.
- **Settlement/Web3:** a future Settlement boundary may reconcile a fiat provider or optional blockchain transfer. Chain, asset, wallet, transaction and confirmation references are settlement context, not Order or Cleaning truth. Business facts remain off-chain; whether/how a future Ledger records settlement is a separate financial decision. Wallet identity is separate from AuthIdentity. Token conversion and Evidence anchoring remain optional future policies.

## 14. Candidate entity decisions

| Candidate | M6 proposal | Reason / owner / truth |
| --- | --- | --- |
| `Order` | Required canonical future model | Orders boundary; one work record across all origins, with standalone manual use supported |
| `ManualOrder` | Current M4 compatibility/creation path only | Future standalone creation conceptually makes `Order(origin=manual)`; do not add a parallel ManualOrder business model |
| `Customer` | No standalone Customer aggregate initially; use registered User ref plus immutable contact snapshot on Order | Avoid duplicate identity/customer registry; promote to separate aggregate only if lifecycle/consent/preferences require it |
| `Cleaning` | Required separate future execution aggregate | Cleaning module owns each planned/actual occurrence and actual work event; multiple per Order |
| `Service` | No standalone Service entity now; Order has service-scope snapshot/value lines | A catalogue can be added if reusable listings/pricing are needed; executed work remains Cleaning |
| `Money` | Required conceptual value boundary | Exact integer minor amount plus currency code; representation details require follow-up |
| `FinancialEvent` | Future conceptual boundary/vocabulary | Economic effect semantics and source relationships require financial review |
| `LedgerEntry` / Ledger | Future conceptual accounting boundary/vocabulary | Posting, immutability, chart, corrections, and source-of-truth role are unresolved |
| `Balance` | Candidate reporting value | Definition and source depend on future product/payment model |
| `Expense` | Candidate future business record | Need, lifecycle, and accounting/tax treatment require separate review |
| `PaymentAttempt` | Candidate external collection attempt, not Order state | Future Settlement/payment-provider design |
| `Payout` | Candidate transfer if Qleanfeel controls cleaner funds | Future product, Settlement, and accounting design |
| `Settlement` | Future optional external transfer boundary | Remains separate from Order/Cleaning facts; details are unresolved |
| `Evidence` | Future independent metadata/provenance aggregate | Evidence module; bytes live in future object storage |
| `Conversation`/`Message` | Future independent communication aggregate | Messaging module; may link to Order/Cleaning/support/no business entity |
| `Dispute` | Future independent claim/adjudication aggregate | Disputes module; money/order effects occur through explicit commands |
| `CleanerProfile` | Optional future role-specific business profile | Profile module; operating settings only, not auth, order, tax history or balance |

## 15. Implementation-readiness answers

- **What is an Order?** A cleaner-created or party-agreed work record for a defined cleaning scope, with source, creator, customer context, terms, and core lifecycle.
- **Where can it originate?** `manual`, `qleanfeel`, `client`; origin is immutable and separate from creator/customer/cleaner.
- **Who can manage it?** The authenticated cleaner manages their standalone manual Order. Future marketplace authorization follows a separately designed participant/resource relationship; a mandatory managing-account field is not required by the core model.
- **Who is customer?** An external snapshot or registered User reference plus preserved order-time snapshot.
- **What is CalendarEntry?** A time interval/availability block, not service agreement/work/finance.
- **What is Cleaning?** One planned/actual work occurrence under an Order, with its own execution lifecycle and events; zero or more per Order, including recurring occurrences.
- **How does Cleaning relate to CalendarEntry?** Cleaning owns `orderId` and may point to at most one active CalendarEntry. It is the execution source of truth; CalendarEntry is only its current schedule. Reschedule updates that entry; cancellation retains it, potentially with Calendar status `cancelled`. Scheduling history is not in the current model.
- **When is work completed?** An authorized `CleaningCompleted` fact with actor and actual UTC `occurredAt`/recorded time; Calendar closure alone is insufficient.
- **When does money become fact?** M6 does not settle this. An Order amount alone is not proof of payment or earnings; financial event/ledger semantics require later approval.
- **What are Earnings and Balance?** Distinct future business/reporting terms whose formulas and sources need separate product/accounting decisions.
- **What is in Ledger?** A future accounting boundary; its source-of-truth role, entries, corrections, and chart of accounts are unresolved.
- **How are currency/tax handled?** Money uses exact integer minor units plus currency code. `Profile.country` is not tax truth; jurisdiction, seller, and tax rules remain future boundary decisions.
- **Where does Messaging attach?** An independent Conversation references optional Order/Cleaning/User/support context; messages are not Order fields.
- **Where does Evidence attach?** Independent Evidence metadata references Order/Cleaning/Dispute/other subject and preserves provenance/access/retention; binary object storage is separate.
- **How can a future client create an Order?** An authenticated client workflow creates origin `client`; a future offer/routing layer can bring it into the same core Order model.
- **How can Qleanfeel create/assign?** A future Qleanfeel workflow creates origin `qleanfeel`; assignment and commercial/legal context belong to that marketplace layer.
- **How can cleaner remain standalone?** Cleaner immediately creates `Order(origin=manual, status=confirmed)` → Cleaning → optional current CalendarEntry → first-class Cleaning events, with optional later FinancialEvent/Ledger; no marketplace negotiation or Qleanfeel-held payout is required.
- **How does a future Client App get work state?** From authorized Order/Cleaning read models and downstream notification events; it does not calculate authoritative business state. Progress/remaining-time values are estimates only.
- **How does Home get data?** Dashboard application/backend projection over Calendar, Orders, Cleaning and Money read models, with timezone/currency/as-of context; never UI-authored financial truth.
- **Where does Web3 begin/end?** Optional settlement/provenance adapter after Money/Ledger; wallet identity and chain transfer do not redefine business facts.

## 16. Review and implementation gate

This architecture and its ADRs are approved as future design direction, not implementation authorization. Accounting, revenue recognition, tax, legal seller, chart of accounts, posting, and payout policies remain explicitly unresolved and require later market-specific review. No M1-M5 source/API behavior is changed by these documents.
