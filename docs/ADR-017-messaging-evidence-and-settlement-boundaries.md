# ADR-017: Messaging, Evidence, Disputes, and Settlement Boundaries

- **Status:** Accepted architecture — implementation deferred
- **Date:** 2026-10-02
- **Scope:** Future domain boundaries only; no implementation in M6
- **Related:** [M6 architecture proposal](M6_ARCHITECTURE_PROPOSAL.md), [Domain/Data Dictionary](DOMAIN_DATA_DICTIONARY.md)

## Context

Future client/cleaner workflows may need communication, proof of work, dispute handling, and multiple settlement rails. Coupling these concepts directly to Order would make Order own unrelated lifecycles and would make the business dependent on a particular media store, payment provider, or blockchain.

## Decision

Messaging is an independent Communication domain. `Conversation` and `Message` are not fields such as `Order.messages[]`; a Conversation may reference an Order, Cleaning, dispute/support context, participants, or no business subject. Membership and message visibility are authorized by the Messaging boundary. Messages alone do not prove work or post money.

Evidence is an independent provenance-bearing concept, not `photos[]`. Evidence metadata may describe a photo, video, document, message reference, customer/cleaner confirmation, timestamp, location assertion, or system event, and may reference Order, Cleaning, Dispute, or another reviewed context. Preserve creator/uploader, claimed occurrence time versus server receipt time, integrity metadata, provenance, access and retention policy/version, and legal-hold/tombstone state. Content bytes live behind a future storage adapter and are outside this milestone. Evidence supports review; it is not automatically a business truth or ledger trigger.

Dispute is an independent future case boundary referencing Orders/Cleanings and Evidence. Its adjudication can request an authorized operation from the owning Order or future financial boundary; exact effects and accounting treatment are separately designed.

Settlement is an optional future boundary for external transfer outcomes. A fiat provider adapter may reconcile payment/payout outcomes; Web3 is another optional rail behind Settlement. Wallet identity is distinct from AuthIdentity; chain/asset/transaction references describe settlement facts only. Off-chain Order, Cleaning, and customer-agreement facts do not depend on a chain transaction. Whether and how a future Ledger records settlement remains a separate financial design decision. Currency/token conversion is not implicit and requires an explicit future policy.

## Consequences

- Messaging, evidence bytes, payment integrations, wallets, tokens, smart contracts, and chain anchoring are all out of M6 scope.
- Conversation/Evidence/Settlement identifiers are references across owned modules, not nested mutable aggregates.
- Privacy, retention, evidence admissibility, encryption, legal holds, payment compliance, and Web3 risk require separate reviewed policies before implementation.

## Review questions

Review evidence access/retention and future settlement terminology with legal/security/accounting stakeholders before relevant implementation milestones.
