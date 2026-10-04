CREATE SCHEMA "qleanfeel";
--> statement-breakpoint
CREATE TABLE "qleanfeel"."auth_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_subject" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_authenticated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qleanfeel"."auth_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "auth_sessions_status_check" CHECK ("qleanfeel"."auth_sessions"."status" IN ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "qleanfeel"."session_refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"replaced_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "qleanfeel"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_status_check" CHECK ("qleanfeel"."users"."status" IN ('active', 'suspended'))
);
--> statement-breakpoint
ALTER TABLE "qleanfeel"."auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "qleanfeel"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qleanfeel"."auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "qleanfeel"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qleanfeel"."session_refresh_tokens" ADD CONSTRAINT "session_refresh_tokens_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "qleanfeel"."auth_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qleanfeel"."session_refresh_tokens" ADD CONSTRAINT "session_refresh_tokens_replaced_by_id_session_refresh_tokens_id_fk" FOREIGN KEY ("replaced_by_id") REFERENCES "qleanfeel"."session_refresh_tokens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_subject_unique" ON "qleanfeel"."auth_identities" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE INDEX "auth_identities_user_id_idx" ON "qleanfeel"."auth_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_status_expiry_idx" ON "qleanfeel"."auth_sessions" USING btree ("user_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "session_refresh_tokens_hash_unique" ON "qleanfeel"."session_refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "session_refresh_tokens_session_active_idx" ON "qleanfeel"."session_refresh_tokens" USING btree ("session_id","consumed_at","revoked_at");
