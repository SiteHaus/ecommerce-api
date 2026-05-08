DO $$ BEGIN
  CREATE TYPE "public"."fulfillment_type" AS ENUM('shipping', 'pickup');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "fulfillment_type" "fulfillment_type" DEFAULT 'shipping' NOT NULL;
