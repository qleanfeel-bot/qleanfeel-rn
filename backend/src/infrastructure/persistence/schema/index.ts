import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const instant = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });
const applicationSchema = pgSchema('qleanfeel');

export const users = applicationSchema.table(
  'users',
  {
    id: uuid('id').primaryKey(),
    status: text('status').notNull(),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  table => [
    check(
      'users_status_check',
      sql`${table.status} IN ('active', 'suspended')`,
    ),
  ],
);

export const authIdentities = applicationSchema.table(
  'auth_identities',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    provider: text('provider').notNull(),
    providerSubject: text('provider_subject').notNull(),
    createdAt: instant('created_at').notNull(),
    lastAuthenticatedAt: instant('last_authenticated_at').notNull(),
  },
  table => [
    uniqueIndex('auth_identities_provider_subject_unique').on(
      table.provider,
      table.providerSubject,
    ),
    index('auth_identities_user_id_idx').on(table.userId),
  ],
);

export const authSessions = applicationSchema.table(
  'auth_sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: text('status').notNull(),
    createdAt: instant('created_at').notNull(),
    expiresAt: instant('expires_at').notNull(),
    revokedAt: instant('revoked_at'),
  },
  table => [
    check(
      'auth_sessions_status_check',
      sql`${table.status} IN ('active', 'revoked')`,
    ),
    index('auth_sessions_user_status_expiry_idx').on(
      table.userId,
      table.status,
      table.expiresAt,
    ),
  ],
);

export const sessionRefreshTokens = applicationSchema.table(
  'session_refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => authSessions.id, { onDelete: 'restrict' }),
    tokenHash: text('token_hash').notNull(),
    createdAt: instant('created_at').notNull(),
    expiresAt: instant('expires_at').notNull(),
    consumedAt: instant('consumed_at'),
    revokedAt: instant('revoked_at'),
    replacedById: uuid('replaced_by_id').references(
      (): AnyPgColumn => sessionRefreshTokens.id,
      { onDelete: 'restrict' },
    ),
  },
  table => [
    uniqueIndex('session_refresh_tokens_hash_unique').on(table.tokenHash),
    index('session_refresh_tokens_session_active_idx').on(
      table.sessionId,
      table.consumedAt,
      table.revokedAt,
    ),
  ],
);
