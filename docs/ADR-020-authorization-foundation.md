# ADR-020 — Authorization Foundation

- **Status:** Accepted implementation decision for M7-B.3; follows ADR-018 and ADR-019
- **Scope:** Framework-independent application authorization boundary; no business resource modules or persistence
- **Related:** [M7 Architecture Proposal](M7_ARCHITECTURE_PROPOSAL.md), [ADR-018](ADR-018-production-backend-foundation.md), [ADR-019](ADR-019-identity-authentication-foundation.md)

## Context

M7-B.2 establishes Qleanfeel authentication and resolves a trusted `AuthenticatedPrincipal`. The backend does not yet contain production Profile, Calendar, Order, or Cleaning use cases. Business authorization must be established as an Application boundary without manufacturing business endpoints or persistence.

## Decision

Authentication and authorization remain distinct. Authentication establishes the caller's identity and the existing guard supplies the trusted `AuthenticatedPrincipal`. Authorization evaluates whether that principal may perform one operation on a resource using relationship and resource facts resolved by the application use case from trusted server state.

The Application boundary consists of an explicit permit/deny decision, a resource policy contract over principal, operation/intent, and already-loaded resource facts, and an application authorization-denial error distinct from credential/authentication errors. The policy contract does not load resources, query persistence, open transactions, or depend on HTTP, NestJS, providers, or database types. The containing use case resolves facts and evaluates policy; it coordinates any consistency-sensitive reads and writes through its existing UnitOfWork.

Ownership, assignment, and participation are facts owned and resolved by the relevant future resource module. Client-supplied user, owner, role, capability, assignment, or participation claims are not authorization facts. Each module owns its resource policies and applies its own state-transition rules.

The HTTP distinction remains: `401` means authentication is missing or invalid; `403` means an authenticated caller is denied; a future resource API may deliberately return `404` to hide a resource's existence. HTTP mapping remains an adapter responsibility.

This decision does not introduce RBAC, role hierarchy, capability registry or administration, a policy engine, global policy registry, or capability persistence. No database migration or schema change is required. Future resource policies are introduced with their owning application modules and real use cases.

## Consequences

- Application use cases have a small reusable policy boundary and can return or translate denial without depending on NestJS.
- The boundary can be unit-tested without a resource database or HTTP endpoint.
- M7-B.3 does not prove integration against business resources because those modules are not in the repository and are outside this scope.
- Authentication, active-account behavior, token/session semantics, and the existing UnitOfWork architecture remain unchanged.
