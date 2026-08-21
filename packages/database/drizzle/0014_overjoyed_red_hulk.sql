ALTER TABLE "stores" ADD COLUMN "easypost_child_user_id" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "easypost_child_api_key" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "stripe_billing_customer_id" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "origin_name" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "origin_line1" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "origin_line2" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "origin_city" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "origin_state" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "origin_zip" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "origin_country" varchar(2);