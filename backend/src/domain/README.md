# Domain layer boundary

M7-B.2 adds framework/provider-independent `User`, `AuthIdentity`, `AuthSession`, and refresh-token record concepts. Domain types remain plain TypeScript and do not depend on Firebase, JWT, NestJS, HTTP, Drizzle, PostgreSQL drivers, or persistence rows. Profile and business modules remain out of scope until their separately scoped implementation steps.
