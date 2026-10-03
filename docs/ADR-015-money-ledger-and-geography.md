# ADR-015: Money and Financial Boundaries

- **Status:** Accepted architecture — implementation deferred
- **Date:** 2026-10-02
- **Scope:** Future financial/business facts; no implementation in M6
- **Related:** [M6 architecture proposal](M6_ARCHITECTURE_PROPOSAL.md), [Domain/Data Dictionary](DOMAIN_DATA_DICTIONARY.md)

## Context

M4 has an optional `quotedPrice` with a JavaScript safe-integer minor-unit amount, but no agreed-price semantics, currency scale policy, earnings, accounting, or balance. A displayed order amount cannot safely be treated as revenue, cleaner earnings, available funds, or payout.

## Decision

Represent canonical money values as `{ amountMinor, currencyCode }`, using an exact integer amount and a currency code. Do not use floating point for canonical financial values. Currency precision, serialization, supported currencies, conversion, and rounding need a later implementation decision informed by platform and market requirements; M6 does not define a complete monetary calculation system.

Keep Money, FinancialEvent, and Ledger as distinct future architecture boundaries and vocabulary. Order terms and future economic/financial facts belong to their owning domains; a quoted/agreed Order amount alone does not mean paid amount, cleaner earnings, revenue, available balance, or payout. The exact relationship among Cleaning completion, recognition, FinancialEvent, ledger postings, and projections remains unresolved for a later accounting design. M6 does not select a chart of accounts, posting model, revenue-recognition rule, tax liability treatment, balance calculation, or accounting standard implementation.

Preserve the boundary principle that Profile country is profile context, not tax truth. Future financial or tax behavior must obtain its relevant context from an explicitly designed business/legal boundary. M6 does not determine the contracting seller, applicable jurisdiction, tax rules/rates, registrations, or historical tax snapshots. Those decisions require market-specific legal/accounting review before financial implementation. Keep schedule instants in UTC and use an IANA timezone identifier for local interpretation; exact timezone field ownership and persistence remain part of the scheduling/API design.

## Consequences

- Current M4 quote representation and UI assumptions remain unchanged; migration must explicitly convert historic values.
- Financial calculations and derived projections must not be invented in Home UI; their source and formulas remain future decisions.
- M6 establishes no accounting, tax, revenue-recognition, or ledger implementation policy.
- Conversion and settlement must remain explicit boundaries; their data model and rules require later review.

## Deferred design details

The Money boundary and integer representation are approved. Supported currencies, precision/serialization details, accounting vocabulary definitions, ledger structure/posting rules, tax policy, revenue recognition, and market-specific implementation remain for later focused product, legal, and accounting review.
