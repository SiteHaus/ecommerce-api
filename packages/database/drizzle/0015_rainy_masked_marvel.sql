CREATE TYPE "public"."postage_ledger_type" AS ENUM('charge', 'refund');--> statement-breakpoint
CREATE TYPE "public"."postage_ledger_status" AS ENUM('pending', 'settled', 'failed');--> statement-breakpoint
CREATE TABLE "parcel_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"length_in" integer NOT NULL,
	"width_in" integer NOT NULL,
	"height_in" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "postage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"easypost_shipment_id" text,
	"amount_cents" integer NOT NULL,
	"type" "postage_ledger_type" NOT NULL,
	"status" "postage_ledger_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "easypost_shipment_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "label_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "service" text;--> statement-breakpoint
ALTER TABLE "parcel_presets" ADD CONSTRAINT "parcel_presets_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postage_ledger" ADD CONSTRAINT "postage_ledger_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postage_ledger" ADD CONSTRAINT "postage_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parcel_presets_store_idx" ON "parcel_presets" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "postage_ledger_store_idx" ON "postage_ledger" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "postage_ledger_status_idx" ON "postage_ledger" USING btree ("status");