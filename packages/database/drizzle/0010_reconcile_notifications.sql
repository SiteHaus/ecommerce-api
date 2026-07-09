-- Reconciles the orphaned 0003_vengeful_mongoose migration: it shared idx 0003
-- with 0003_parched_tag, so the journal only recorded parched_tag and this DDL
-- (notification_logs table + stores.notification_preferences /
-- .abandoned_cart_emails_enabled) never applied. Re-issued here at idx 10 and
-- made idempotent so it no-ops on envs already patched by hand.
CREATE TABLE IF NOT EXISTS "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"recipient_email" text NOT NULL,
	"event" varchar(64) NOT NULL,
	"status" varchar(16) NOT NULL,
	"resend_message_id" text,
	"error_message" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "abandoned_cart_emails_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_logs_store_event_idx" ON "notification_logs" USING btree ("store_id","event","sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_logs_recipient_idx" ON "notification_logs" USING btree ("recipient_email");
