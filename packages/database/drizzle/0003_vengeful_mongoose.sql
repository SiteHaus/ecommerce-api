CREATE TABLE "notification_logs" (
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
ALTER TABLE "stores" ADD COLUMN "notification_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "abandoned_cart_emails_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_logs_store_event_idx" ON "notification_logs" USING btree ("store_id","event","sent_at");--> statement-breakpoint
CREATE INDEX "notification_logs_recipient_idx" ON "notification_logs" USING btree ("recipient_email");