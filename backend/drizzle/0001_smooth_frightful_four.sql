CREATE TABLE "qleanfeel"."calendar_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"timezone_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "calendar_entries_type_check" CHECK ("qleanfeel"."calendar_entries"."type" IN ('external_order', 'blocked', 'personal')),
	CONSTRAINT "calendar_entries_status_check" CHECK ("qleanfeel"."calendar_entries"."status" IN ('scheduled', 'cancelled', 'completed')),
	CONSTRAINT "calendar_entries_interval_check" CHECK ("qleanfeel"."calendar_entries"."start_at" < "qleanfeel"."calendar_entries"."end_at"),
	CONSTRAINT "calendar_entries_version_check" CHECK ("qleanfeel"."calendar_entries"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "qleanfeel"."cleanings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"calendar_entry_id" uuid,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "cleanings_status_check" CHECK ("qleanfeel"."cleanings"."status" IN ('planned', 'in_progress', 'completed', 'partially_completed', 'not_performed', 'cancelled')),
	CONSTRAINT "cleanings_version_check" CHECK ("qleanfeel"."cleanings"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "qleanfeel"."order_terms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"service_description" text NOT NULL,
	"service_address" text NOT NULL,
	"quoted_price_amount_minor" integer,
	"quoted_price_currency_code" text,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "order_terms_revision_check" CHECK ("qleanfeel"."order_terms"."revision" > 0),
	CONSTRAINT "order_terms_quote_pair_check" CHECK (("qleanfeel"."order_terms"."quoted_price_amount_minor" IS NULL) = ("qleanfeel"."order_terms"."quoted_price_currency_code" IS NULL)),
	CONSTRAINT "order_terms_quote_amount_check" CHECK ("qleanfeel"."order_terms"."quoted_price_amount_minor" IS NULL OR "qleanfeel"."order_terms"."quoted_price_amount_minor" >= 0),
	CONSTRAINT "order_terms_quote_currency_check" CHECK ("qleanfeel"."order_terms"."quoted_price_currency_code" IS NULL OR "qleanfeel"."order_terms"."quoted_price_currency_code" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "qleanfeel"."orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "orders_origin_check" CHECK ("qleanfeel"."orders"."origin" IN ('manual', 'qleanfeel', 'client')),
	CONSTRAINT "orders_status_check" CHECK ("qleanfeel"."orders"."status" IN ('draft', 'confirmed', 'cancelled', 'partially_fulfilled', 'fulfilled')),
	CONSTRAINT "orders_version_check" CHECK ("qleanfeel"."orders"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "qleanfeel"."calendar_entries" ADD CONSTRAINT "calendar_entries_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "qleanfeel"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qleanfeel"."cleanings" ADD CONSTRAINT "cleanings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "qleanfeel"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qleanfeel"."cleanings" ADD CONSTRAINT "cleanings_calendar_entry_id_calendar_entries_id_fk" FOREIGN KEY ("calendar_entry_id") REFERENCES "qleanfeel"."calendar_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qleanfeel"."order_terms" ADD CONSTRAINT "order_terms_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "qleanfeel"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qleanfeel"."orders" ADD CONSTRAINT "orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "qleanfeel"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_entries_owner_start_idx" ON "qleanfeel"."calendar_entries" USING btree ("owner_user_id","start_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "cleanings_calendar_entry_unique" ON "qleanfeel"."cleanings" USING btree ("calendar_entry_id");--> statement-breakpoint
CREATE INDEX "cleanings_order_created_idx" ON "qleanfeel"."cleanings" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "order_terms_order_revision_unique" ON "qleanfeel"."order_terms" USING btree ("order_id","revision");--> statement-breakpoint
CREATE INDEX "orders_creator_created_idx" ON "qleanfeel"."orders" USING btree ("created_by_user_id","created_at","id");