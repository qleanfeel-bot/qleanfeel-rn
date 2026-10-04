# ADR-019: Identity and Authentication Foundation

- **Status:** Accepted implementation decision for M7-B.2; follows approved M7-A / ADR-018 architecture
- **Scope:** Internal User, external AuthIdentity, per-device AuthSession, Firebase identity proof, Qleanfeel access credentials, refresh rotation, logout, and `/v1/me`
- **Related:** [M7 Architecture Proposal](M7_ARCHITECTURE_PROPOSAL.md), [ADR-018](ADR-018-production-backend-foundation.md), [ADR-020](ADR-020-authorization-foundation.md)

## Decision

Keep `User`, `AuthIdentity`, `AuthSession`, and `SessionRefreshToken` provider-independent domain concepts. Application use cases depend on repository, identity-proof, access-credential, refresh-credential, identifier, clock, and UnitOfWork ports. NestJS, Firebase Admin, JOSE, Drizzle, PostgreSQL rows, HTTP requests, and token formats remain in infrastructure or HTTP adapters.

Firebase Admin verifies Firebase ID tokens with revocation checks enabled. Its adapter returns only normalized `(provider, providerSubject)` data; the Firebase UID is never used as the Qleanfeel User ID. Bootstrap verifies proof before opening a database transaction. The transaction then resolves or provisions User/AuthIdentity and creates one session with its refresh-token hash. A unique `(provider, provider_subject)` index is the concurrency safeguard; a collision rolls back the first attempt and retries resolution in a fresh UnitOfWork.

Qleanfeel access credentials are signed HS256 JWTs with only issuer, audience, subject (`userId`), session ID, issue time, and expiry. Each authenticated request verifies the signature and then checks the current User and AuthSession in PostgreSQL. Revocation and account suspension therefore take effect on the next protected request. Access-token signing uses `ACCESS_TOKEN_SIGNING_SECRET`, which must contain at least 32 UTF-8 bytes. Firebase Admin uses Application Default Credentials and `FIREBASE_PROJECT_ID`; no service-account JSON or provider credential is stored in the application database.

Refresh credentials contain 256 random bits and a session-ID lookup prefix. The complete credential is SHA-256 hashed before persistence. The prefix is checked against the session ID on the matching hash row; it is not trusted as authorization. A refresh locks the session row before the refresh-token row, consumes the current token, and inserts its replacement in one UnitOfWork. The session has a fixed expiry from bootstrap; rotation does not extend it. Reuse of a consumed token is rejected without token-family recovery behavior.

Logout uses the authenticated principal and one UnitOfWork to revoke that session and its unconsumed refresh credentials. Other sessions for the same User remain active. `/v1/me` returns only the Qleanfeel User identity and account status; it does not expose Firebase identity or Profile fields.

The first migration creates the dedicated `qleanfeel` application schema and only `users`, `auth_identities`, `auth_sessions`, and `session_refresh_tokens` within it. It preserves the M7-B.1 Drizzle migration journal in `public` and applies migrations as an explicit CI/operator step. No Profile, business, capability, or generic idempotency tables are introduced.

## Initial implementation defaults

- Access credential lifetime defaults to 300 seconds and is configurable from 30 to 3,600 seconds.
- Session and refresh credential lifetime defaults to 2,592,000 seconds (30 days) and is configurable from 600 to 31,536,000 seconds.
- Refresh rotation retains the session's original expiry; it does not create a sliding session.
- Suspended Qleanfeel accounts receive `403`; invalid/expired/revoked access or refresh credentials receive `401`; Firebase verification infrastructure failures receive a generic `503`.

These are implementation defaults required to run the foundation, not final product lifetime or recovery policy. Exact lifetimes, advanced refresh-reuse recovery, logout-all, browser transport, additional providers, and full business authorization remain deferred.
