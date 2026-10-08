import { sql } from 'drizzle-orm';
import {
  check,
  bigint,
  index,
  integer,
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

export const orders = applicationSchema.table(
  'orders',
  {
    id: uuid('id').primaryKey(),
    origin: text('origin').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: text('status').notNull(),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
    version: integer('version').notNull(),
  },
  table => [
    check(
      'orders_origin_check',
      sql`${table.origin} IN ('manual', 'qleanfeel', 'client')`,
    ),
    check(
      'orders_status_check',
      sql`${table.status} IN ('draft', 'confirmed', 'cancelled', 'partially_fulfilled', 'fulfilled')`,
    ),
    check('orders_version_check', sql`${table.version} > 0`),
    index('orders_creator_created_idx').on(
      table.createdByUserId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const orderTerms = applicationSchema.table(
  'order_terms',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    revision: integer('revision').notNull(),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone'),
    serviceDescription: text('service_description').notNull(),
    serviceAddress: text('service_address').notNull(),
    quotedPriceAmountMinor: bigint('quoted_price_amount_minor', {
      mode: 'number',
    }),
    quotedPriceCurrencyCode: text('quoted_price_currency_code'),
    notes: text('notes'),
    createdAt: instant('created_at').notNull(),
  },
  table => [
    uniqueIndex('order_terms_order_revision_unique').on(
      table.orderId,
      table.revision,
    ),
    check('order_terms_revision_check', sql`${table.revision} > 0`),
    check(
      'order_terms_quote_pair_check',
      sql`(${table.quotedPriceAmountMinor} IS NULL) = (${table.quotedPriceCurrencyCode} IS NULL)`,
    ),
    check(
      'order_terms_quote_amount_check',
      sql`${table.quotedPriceAmountMinor} IS NULL OR (${table.quotedPriceAmountMinor} >= 0 AND ${table.quotedPriceAmountMinor} <= 9007199254740991)`,
    ),
    check(
      'order_terms_quote_currency_check',
      sql`${table.quotedPriceCurrencyCode} IS NULL OR ${table.quotedPriceCurrencyCode} ~ '^[A-Z]{3}$'`,
    ),
  ],
);

export const calendarEntries = applicationSchema.table(
  'calendar_entries',
  {
    id: uuid('id').primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: text('type').notNull(),
    status: text('status').notNull(),
    title: text('title').notNull(),
    startAt: instant('start_at').notNull(),
    endAt: instant('end_at').notNull(),
    timeZoneId: text('timezone_id'),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
    version: integer('version').notNull(),
  },
  table => [
    check(
      'calendar_entries_type_check',
      sql`${table.type} IN ('external_order', 'blocked', 'personal')`,
    ),
    check(
      'calendar_entries_status_check',
      sql`${table.status} IN ('scheduled', 'cancelled', 'completed')`,
    ),
    check(
      'calendar_entries_interval_check',
      sql`${table.startAt} < ${table.endAt}`,
    ),
    check('calendar_entries_version_check', sql`${table.version} > 0`),
    index('calendar_entries_owner_start_idx').on(
      table.ownerUserId,
      table.startAt,
      table.id,
    ),
  ],
);

export const cleanings = applicationSchema.table(
  'cleanings',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    calendarEntryId: uuid('calendar_entry_id').references(
      () => calendarEntries.id,
      { onDelete: 'restrict' },
    ),
    status: text('status').notNull(),
    startedAt: instant('started_at'),
    completedAt: instant('completed_at'),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
    version: integer('version').notNull(),
  },
  table => [
    check(
      'cleanings_status_check',
      sql`${table.status} IN ('planned', 'in_progress', 'completed', 'partially_completed', 'not_performed', 'cancelled')`,
    ),
    check('cleanings_version_check', sql`${table.version} > 0`),
    check(
      'cleanings_started_at_status_check',
      sql`(${table.status} IN ('in_progress', 'completed', 'partially_completed') AND ${table.startedAt} IS NOT NULL) OR (${table.status} IN ('planned', 'cancelled') AND ${table.startedAt} IS NULL) OR ${table.status} = 'not_performed'`,
    ),
    check(
      'cleanings_completed_at_status_check',
      sql`(${table.status} IN ('completed', 'partially_completed', 'not_performed')) = (${table.completedAt} IS NOT NULL)`,
    ),
    check(
      'cleanings_lifecycle_time_order_check',
      sql`(${table.startedAt} IS NULL OR ${table.startedAt} <= ${table.updatedAt}) AND (${table.completedAt} IS NULL OR ${table.completedAt} <= ${table.updatedAt}) AND (${table.startedAt} IS NULL OR ${table.completedAt} IS NULL OR ${table.startedAt} <= ${table.completedAt})`,
    ),
    uniqueIndex('cleanings_calendar_entry_unique').on(table.calendarEntryId),
    index('cleanings_order_created_idx').on(table.orderId, table.createdAt),
  ],
);

export const cleaningLifecycleEvents = applicationSchema.table(
  'cleaning_lifecycle_events',
  {
    id: uuid('id').primaryKey(),
    cleaningId: uuid('cleaning_id')
      .notNull()
      .references(() => cleanings.id, { onDelete: 'restrict' }),
    eventType: text('event_type').notNull(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    occurredAt: instant('occurred_at').notNull(),
    recordedAt: instant('recorded_at').notNull(),
    version: integer('version').notNull(),
  },
  table => [
    check(
      'cleaning_lifecycle_events_type_check',
      sql`${table.eventType} IN ('started', 'completed', 'partially_completed', 'cancelled', 'not_performed')`,
    ),
    check('cleaning_lifecycle_events_version_check', sql`${table.version} > 1`),
    check(
      'cleaning_lifecycle_events_recorded_order_check',
      sql`${table.occurredAt} <= ${table.recordedAt}`,
    ),
    uniqueIndex('cleaning_lifecycle_events_cleaning_version_unique').on(
      table.cleaningId,
      table.version,
    ),
  ],
);
