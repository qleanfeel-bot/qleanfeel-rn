import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL;

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/persistence/schema/index.ts',
  out: './drizzle',
  ...(migrationDatabaseUrl
    ? { dbCredentials: { url: migrationDatabaseUrl } }
    : {}),
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public',
  },
  strict: true,
  verbose: true,
});
