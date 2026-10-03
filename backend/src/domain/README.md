# Domain layer boundary

M7-B.1 introduces no business entities. Later domain modules belong here as framework-free TypeScript: no NestJS, HTTP, Drizzle, PostgreSQL driver, or persistence-row dependencies. Add a domain module only with its separately scoped business implementation step.
