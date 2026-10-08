CREATE TABLE "qleanfeel"."cleaning_lifecycle_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cleaning_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "cleaning_lifecycle_events_type_check" CHECK ("qleanfeel"."cleaning_lifecycle_events"."event_type" IN ('started', 'completed', 'partially_completed', 'cancelled', 'not_performed')),
	CONSTRAINT "cleaning_lifecycle_events_version_check" CHECK ("qleanfeel"."cleaning_lifecycle_events"."version" > 1),
	CONSTRAINT "cleaning_lifecycle_events_recorded_order_check" CHECK ("qleanfeel"."cleaning_lifecycle_events"."occurred_at" <= "qleanfeel"."cleaning_lifecycle_events"."recorded_at")
);
--> statement-breakpoint
ALTER TABLE "qleanfeel"."cleanings" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "qleanfeel"."cleanings" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "qleanfeel"."cleaning_lifecycle_events" ADD CONSTRAINT "cleaning_lifecycle_events_cleaning_id_cleanings_id_fk" FOREIGN KEY ("cleaning_id") REFERENCES "qleanfeel"."cleanings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qleanfeel"."cleaning_lifecycle_events" ADD CONSTRAINT "cleaning_lifecycle_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "qleanfeel"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cleaning_lifecycle_events_cleaning_version_unique" ON "qleanfeel"."cleaning_lifecycle_events" USING btree ("cleaning_id","version");--> statement-breakpoint
ALTER TABLE "qleanfeel"."cleanings" ADD CONSTRAINT "cleanings_started_at_status_check" CHECK (("qleanfeel"."cleanings"."status" IN ('in_progress', 'completed', 'partially_completed') AND "qleanfeel"."cleanings"."started_at" IS NOT NULL) OR ("qleanfeel"."cleanings"."status" IN ('planned', 'cancelled') AND "qleanfeel"."cleanings"."started_at" IS NULL) OR "qleanfeel"."cleanings"."status" = 'not_performed');--> statement-breakpoint
ALTER TABLE "qleanfeel"."cleanings" ADD CONSTRAINT "cleanings_completed_at_status_check" CHECK (("qleanfeel"."cleanings"."status" IN ('completed', 'partially_completed', 'not_performed')) = ("qleanfeel"."cleanings"."completed_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "qleanfeel"."cleanings" ADD CONSTRAINT "cleanings_lifecycle_time_order_check" CHECK (("qleanfeel"."cleanings"."started_at" IS NULL OR "qleanfeel"."cleanings"."started_at" <= "qleanfeel"."cleanings"."updated_at") AND ("qleanfeel"."cleanings"."completed_at" IS NULL OR "qleanfeel"."cleanings"."completed_at" <= "qleanfeel"."cleanings"."updated_at") AND ("qleanfeel"."cleanings"."started_at" IS NULL OR "qleanfeel"."cleanings"."completed_at" IS NULL OR "qleanfeel"."cleanings"."started_at" <= "qleanfeel"."cleanings"."completed_at"));
