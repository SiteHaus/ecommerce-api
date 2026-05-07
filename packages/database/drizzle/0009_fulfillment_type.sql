CREATE TYPE "public"."fulfillment_type" AS ENUM('shipping', 'pickup');--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "fulfillment_type" "fulfillment_type" DEFAULT 'shipping' NOT NULL;
