# Qleanfeel Domain/Data Dictionary — M6 Proposal

- **Status:** Approved M6 architecture reference; implementation deferred
- **Baseline:** M1-M5 as merged in `origin/main` (`59c2636`)
- **Terms:** `CURRENT` means code exists today; `PROPOSED` means M6 target architecture, not implemented; `FUTURE` means a bounded domain considered for later product work.
- **Companion:** [M6 Architecture Proposal](M6_ARCHITECTURE_PROPOSAL.md)

This dictionary records business meaning, owner/source of truth, persistence classification, mutability and lifecycle. DTO names do not create domain entities. A read projection/cache is never a second writable source of truth.

## Identity and profile — current

| Entity / field | Meaning | Owner / source of truth | Stored or derived | Mutable / lifecycle / constraints |
| --- | --- | --- | --- | --- |
| `User.id` | Internal Qleanfeel user identity | Identity domain | Stored | Immutable server ID |
| `User.status` | Account allowed/suspended state (`active`, `suspended`) | Identity domain | Stored | Server-controlled audited transition; authorization input |
| `User.createdAt`, `updatedAt` | Account creation and last domain update instants | Identity domain | Stored | Server timestamps; `updatedAt` changes with accepted account mutation |
| `AuthIdentity.id` | Link record ID | Identity domain | Stored | Immutable |
| `AuthIdentity.userId` | Internal User linked to provider subject | Identity domain | Stored | Immutable except audited account linking/unlinking workflow |
| `AuthIdentity.provider` | External authentication authority (`firebase` is the only current code value) | Identity/auth adapter | Stored | Current model is narrower than abstraction; provider type changes require auth design |
| `AuthIdentity.providerSubject` | Provider-specific stable subject, not Qleanfeel User ID | Provider verification plus Identity mapping | Stored | Sensitive identity key; never treat as business owner/role |
| `AuthIdentity.createdAt`, `lastAuthenticatedAt` | Link and last successful provider-auth instants | Identity domain | Stored | Server/adapter-controlled timestamps |
| `AuthSession.id`, `userId` | Qleanfeel session record identity and associated User | Identity domain | Stored | Session ID immutable; current app AuthState does not carry it |
| `AuthSession.status` | `active`, `expired`, `revoked` | Identity/session subsystem | Stored | Server/session lifecycle; terminal expiry/revocation is not login provider credential |
| `AuthSession.createdAt`, `expiresAt`, `revokedAt` | Session lifecycle instants | Identity/session subsystem | Stored | Server timestamps; credential/token material is excluded |
| `Profile.userId` | User associated with generic profile | Profile domain | Stored | Identity foreign reference; `/me` server resolves caller |
| `Profile.displayName` | User-editable display name | Profile domain | Stored | Mutable through `PATCH /v1/me/profile` |
| `Profile.phone`, `email`, `avatar`, `locale` | Optional display/contact/preferences | Profile domain | Stored | Nullable strings today; field-specific verification/privacy policy absent |
| `Profile.country` | Optional user profile country string today | Profile domain | Stored | Current code has no format/authority semantics; proposed meaning is profile/home context only, not tax/work jurisdiction |
| `CleanerProfile` (proposed) | Optional cleaner role/business operating settings | Profile/business-settings module; associated with User | Stored | Separate from generic Profile/AuthIdentity; operating locations and dashboard timezone can change with effective history; never source of historical order tax or money |
| Client capability/profile (proposed) | Registered Client role on a Qleanfeel User | Identity/authorization; Profile remains generic | Role/capability stored by server | No standalone Client or Customer aggregate until separate lifecycle needs exist |

## Calendar and current manual order — current

| Entity / field | Meaning | Owner / source of truth | Stored or derived | Mutable / lifecycle / constraints |
| --- | --- | --- | --- | --- |
| `CalendarEntry.id` | Calendar interval ID | Calendar domain/backend | Stored | Server-assigned immutable ID |
| `CalendarEntry.startAt`, `endAt` | Absolute UTC schedule instants | Calendar domain/backend | Stored | `startAt < endAt`; half-open `[startAt,endAt)`; current format requires UTC `Z`; PATCH may change schedule |
| `CalendarEntry.type` | `external_order`, `blocked`, `personal` | Calendar domain | Stored | Current M3/M4 values remain valid; M4 `external_order` links to ManualOrder. Future Orders are not CalendarEntries; a Qleanfeel Order appears on Calendar only through a scheduled Cleaning |
| `CalendarEntry.status` | `scheduled`, `cancelled`, `completed` | Calendar domain | Stored | Current M3 lifecycle; `completed` means the schedule block was closed, not that a Cleaning occurred |
| `CalendarEntry.title` | Calendar display label | Calendar domain | Stored | Mutable text; not order details |
| `CalendarEntry` user ownership | Authenticated current user's Calendar resource scope | Server `/me` auth context (fake in dev) | Derived authorization relation today; not a client field | No `userId` stored in client entity/DTO; production backend must enforce resource ownership |
| Future `CalendarEntry.timeZoneId` / local-time context | IANA zone and wall-time context used when scheduling | Calendar/Order scheduling command based on service location or explicit personal-calendar preference | Stored alongside UTC instants | Proposed; captures display/DST interpretation; UTC instant remains actual scheduled instant |
| Future Cleaning/CalendarEntry relation | Current CalendarEntry for a scheduled Cleaning | Cleaning owns optional `calendarEntryId`; reverse association is a query/read model | One active CalendarEntry at most per Cleaning | Reschedule updates that entry; cancellation retains it and may set Calendar status to cancelled; no scheduling history in current model; standalone M3 entries remain valid |
| `ManualOrder.id` | Current M4 order-record ID | ManualOrder development/backend contract | Stored | Server/development assigned |
| `ManualOrder.customerName`, `customerPhone` | Current customer contact snapshot | ManualOrder today; future CustomerReference snapshot on Order | Stored | Contact corrections must be audited; future registered-user linking must not overwrite snapshot |
| `ManualOrder.serviceDescription`, `serviceAddress` | Current service scope/address text | ManualOrder today; future Order service snapshot | Stored | Today required strings; address country/jurisdiction/timezone not modeled |
| `ManualOrder.calendarEntryId` | Required M4 reference to scheduled CalendarEntry | ManualOrder today | Stored FK-like reference | Current invariant requires entry; target Order may be unscheduled and Cleaning carries optional current schedule reference |
| `ManualOrder.createdAt` | Record creation instant | M4 server/development handler | Stored | Immutable |
| `ManualOrder.quotedPrice` | Current optional `{ amountMinor: number, currencyCode: string }` estimate | ManualOrder today | Stored | Safe non-negative integer and uppercase 3-letter code; M4 UI assumes RUB/100; not agreed consideration, earnings, revenue or balance |
| `ManualOrder.notes` | Free-text order note | ManualOrder today | Stored | Mutable UI state today; future retention/PII limits require policy |

`ManualOrder` is a current domain entity, not an already-existing canonical Order. Future `/manual-orders` compatibility must map into Order, not create a second persistent aggregate.

## Canonical Order and parties — proposed

| Entity / field | Meaning | Owner / source of truth | Stored or derived | Mutable / lifecycle / constraints |
| --- | --- | --- | --- | --- |
| `Order.id` | Canonical business-work identity | Orders module | Stored | Server-assigned immutable opaque ID |
| `Order.origin` | Creation channel: `manual`, `qleanfeel`, `client`, future explicit codes | Orders module, derived from trusted command route/principal | Stored | Immutable; not caller-selected free text |
| `Order.createdBy` | User or platform principal issuing create command | Identity + Orders audit context | Stored | Immutable; separate from origin/customer/cleaner |
| `Order.customer.userId` | Optional registered Qleanfeel customer/Client identity | Identity reference in Orders | Stored nullable reference | Added only after authorized identity link/consent; no matching by name/phone alone |
| `Order.customer.snapshot` | Order-time customer name/contact details for external or registered party | Orders | Stored immutable historical snapshot | Historical snapshot retained after Profile changes/account linking; correction is audited version, not profile overwrite |
| `Order.assignedCleanerUserId` | Cleaner assigned to perform the work, if assignment is part of the workflow | Order/assignment boundary | Optional stored reference | Assignment is separate from origin and creator; standalone cleaner Orders do not require a marketplace assignment workflow |
| `Order.serviceSnapshot` | Agreed work description/scope, service location and optional catalogue ref | Orders | Stored immutable per accepted term version | No mutable reference to current Profile/address/catalogue; amendments append new accepted version |
| `Order.priceTerms.quote[]` | Versioned price/offer snapshots | Orders | Stored immutable versions | `quoted` state is not an accepted agreement or financial posting |
| `Order.priceTerms.agreed[]` | Agreed service scope and price, if captured | Orders | Stored as Order terms; exact versioning and amendment behavior require later design | Price is not payment, earnings, revenue, or balance; marketplace/commercial components are optional future context |
| `Order.status` | Core work-record/agreement lifecycle | Orders | Stored current state | Proposed core states: draft, confirmed, cancelled, partially_fulfilled, fulfilled. Manual creation starts confirmed; draft remains for complex future workflows. Offer/routing states are future marketplace extensions |
| `Order.createdAt`, `updatedAt`, `version` | Server audit/concurrency values | Orders | Stored | Server-controlled; version increments for accepted state/term mutation |
| `Cleaning.orderId` / Order-to-Cleaning view | Cleaning references its Order; one Order may have multiple Cleanings, including recurring occurrences | Cleaning owns the primary reference; reverse list is a query/read-model projection | Stored one-way reference; reverse view derived | Do not store a mutable `Order.cleaningIds` aggregate field |
| `CustomerReference` | Value object on Order: optional User reference plus customer snapshot | Orders | Stored with Order term/version | Not a standalone Customer table by default; external guest is supported without registration |
| `Customer` aggregate | Independent customer record with preferences/consent/history | No current owner | Not proposed for initial implementation | Add only if registered client lifecycle needs exceed User + Profile + Order snapshot |
| `CleanerProfile` | Cleaner-specific operating context | Profile module | Stored optional role profile | Does not own Order, tax assessment, available balance, or authentication |

## Cleaning and schedule — proposed

| Entity / field | Meaning | Owner / source of truth | Stored or derived | Mutable / lifecycle / constraints |
| --- | --- | --- | --- | --- |
| `Cleaning.id` | One planned/actual execution occurrence | Cleaning module | Stored | Immutable server ID |
| `Cleaning.orderId` | Canonical Order whose scope this occurrence performs | Orders reference validated by Cleaning | Stored required reference | Immutable except audited replacement/migration |
| `Cleaning.assignedCleanerUserId` | Actual occurrence performer | Cleaning assignment workflow | Stored | Changes only by audited reassignment; may differ among Cleanings under one Order |
| `Cleaning.calendarEntryId` | Optional reference to the current Calendar schedule | Cleaning module schedule relation | Stored nullable reference | At most one active entry for a Cleaning; rescheduling updates the existing CalendarEntry; cancellation does not delete it; schedule history is not in the current model |
| `Cleaning.status` | planned, in_progress, completed, partially_completed, not_performed, cancelled | Cleaning module | Current state + first-class lifecycle events | Cleaning is the source of truth for execution; lifecycle events include CleaningStarted and CleaningCompleted |
| `Cleaning.startedAt`, `completedAt` | Actual work instants, not appointment times | Cleaning lifecycle event/state | Stored in Cleaning facts | Actual execution times are distinct from the CalendarEntry schedule; event detail policy can be finalized during implementation |
| `Cleaning.outcome/performedScope` | What was actually done or omitted | Cleaning | Cleaning fact/event | Used to distinguish full and partial completion; financial allocation is not defined by M6 |
| `Service` catalogue | Reusable service listing/pricing | No current owner | Not a required entity now | Order carries service snapshot; add catalogue only for repeatable offerings/search/pricing lifecycle |

## Business events and delivery — future

| Entity / field | Meaning | Owner / source of truth | Stored or derived | Mutable / lifecycle / constraints |
| --- | --- | --- | --- | --- |
| `CleaningStarted`, `CleaningCompleted`, `CleaningPartiallyCompleted` | First-class business facts in the Cleaning lifecycle | Cleaning | Recorded lifecycle events | Cleaning is the source of truth for execution; notification delivery is downstream and does not replace these facts |
| `Notification` | Downstream delivery of an authorized business event | Future notification/delivery boundary | Delivery attempt/status, if implemented | Not authoritative Order/Cleaning state; a future Client App consumes authorized read models/events and does not calculate business truth |
| `ProgressEstimate` / remaining time | Estimate derived from work or timing inputs | Future application projection | Derived, not business fact | Optional future capability; never authoritative Cleaning lifecycle state |

## Money and financial records — proposed/future

| Entity / field | Meaning | Owner / source of truth | Stored or derived | Mutable / lifecycle / constraints |
| --- | --- | --- | --- | --- |
| `Money.amountMinor` | Exact integer amount in minor units paired with currency code | Money value boundary | Stored/transport representation to be decided | No floating-point canonical money; precision and serialization policy require later review |
| `Money.currencyCode` | Currency associated with an amount | Money value boundary | Stored with a money value | Supported-code and minor-unit policy require later review; no implicit cross-currency arithmetic |
| `FinancialEvent` | Candidate record of an economically meaningful event | Future Money boundary, with source domain references | Stored fact if adopted | Event types, immutability, triggers, actor/audit fields and lifecycle remain for financial architecture review |
| `LedgerEntry` / Ledger | Candidate accounting record and ledger boundary | Future Money/accounting boundary | Stored if adopted | Source-of-truth status, posting model, correction, chart of accounts and transaction rules are unresolved in M6 |
| `Earnings`, `Revenue`, `Balance`, `Net income` | Distinct business/accounting vocabulary, not synonyms for Order price | Future Money/reporting boundary | Derived/projection candidates | Exact definitions, classification, accounting basis, period and formulas require separate approval; Home must not invent them |
| `Expense` | Potential cleaner business-cost record | Future Money/product boundary | Stored if implemented | Categories, incurred/paid/recognized states and tax handling are unresolved |
| `Payout` / `Settlement` | Potential external movement/reconciliation facts | Future Settlement boundary | Stored if implemented | Only relevant if product controls or tracks a payment/transfer; lifecycle and accounting effects remain unresolved |
| `Tax / jurisdiction context` | Future legal/accounting inputs attached at an approved boundary | Future market/tax policy boundary | To be decided | `Profile.country` is not tax truth; rates, jurisdiction, seller, tax treatment and historical snapshot rules are outside M6 |

## Messaging, Evidence and dispute — future

| Entity / field | Meaning | Owner / source of truth | Stored or derived | Mutable / lifecycle / constraints |
| --- | --- | --- | --- | --- |
| `Conversation.id/participants` | Independent communication thread and access membership | Messaging module | Stored | Participants may change with audited membership; not `Order.messages[]` |
| `Conversation.contextType/contextId` | Optional Order, Cleaning, support/dispute or no business subject | Messaging link | Stored reference | Business subject existence/visibility checked; conversation may exist without Order |
| `Message.id/sender/body/createdAt` | One communication item | Messaging module | Stored append-only | Corrections/deletion policy is audited; sender identity from auth, not payload claim |
| `Message delivery/read receipts` | Per-recipient transport/acknowledgment state | Messaging/transport | Stored events or derived delivery projection | Not Order status, work proof or financial fact by themselves |
| `Evidence.id/kind/subjectRef` | Evidence metadata and typed relation to Order/Cleaning/Dispute/other context | Evidence module | Stored | Kinds include photo/video/document/message ref/confirmation/timestamp/location assertion/system event; not reduced to photos array |
| `Evidence.creator/uploader/occurredAt/receivedAt` | Who supplied it, claimed capture/work time and server receipt time | Evidence provenance | Stored immutable | Distinguish user assertion from server-observed time |
| `Evidence.objectRef/contentType/size/hash` | Opaque future binary object location and integrity metadata | Evidence + object-store adapter | Metadata stored; bytes in separate object storage | Hash algorithm/digest immutable; no storage/upload implemented in M6 |
| `Evidence.provenance/access/retention/legalHold/status` | Origin, permissions, retention policy/version, hold, availability/tombstone | Evidence module/policy | Stored policy snapshot and state | Access checked for each participant/case; retention by jurisdiction; legal hold prevents purge |
| `Dispute.id/subject/parties/reason/evidenceRefs` | Independent claim over an Order/Cleaning outcome | Disputes module | Stored | Order/Cleaning are references, not embedded dispute state |
| `Dispute.status/decision/reviewer/timestamps` | Claim review and outcome | Disputes module | Stored transition events | Open → evidence requested → review → resolved/withdrawn; decision issues Money/Order commands, never edits Ledger directly |

## Presentation projections — current and proposed

| Entity / field | Meaning | Owner / source of truth | Stored or derived | Mutable / lifecycle / constraints |
| --- | --- | --- | --- | --- |
| M5 Home `displayName` | Greeting sourced from ProfileService | Profile | Read value in presentation | Not a business projection |
| M5 Home `todayOrders` | Current UI join of scheduled external-order CalendarEntries and ManualOrders | Calendar + ManualOrder services | Derived in React component today | Current M5 behavior; no Money and no backend read model; do not refactor in M6 |
| Future `HomeDashboard.asOf/timeZoneId` | Version/timezone context for projection | Dashboard module | Derived response metadata | Every aggregate describes source freshness and bucket zone |
| Future `HomeDashboard.schedule/orders/actions` | Today's work and pending authorized actions | Calendar/Orders/Cleaning | Derived projection | Includes source IDs and permissions; not writable business truth |
| Future `HomeDashboard.earnings/expenses/availableBalance` | Optional future financial summary values | Future Dashboard projection from approved Money sources | Derived only if definitions/source are adopted | Formulas, basis, currencies and availability rules require separate financial review; Home does not invent them |

## Explicitly absent from the M1-M5 model

There is no current canonical Order, registered Customer/Client business profile, CleanerProfile, Cleaning execution, Money value type, FinancialEvent, Ledger, expense, payment, payout, settlement, Dashboard service, Messaging, Evidence, Dispute or Web3 settlement entity. The proposed dictionary above must not be read as implemented API or schema.
