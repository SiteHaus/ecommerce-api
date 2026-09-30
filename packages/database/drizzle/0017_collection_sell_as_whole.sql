-- Idempotent on purpose: a database that already has some of these objects
-- (e.g. from `drizzle-kit push`) can still run this migration cleanly.
ALTER TABLE "cart_items" ALTER COLUMN "variant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "collection_id" uuid;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "sell_as_whole" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "price_cents" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "collection_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_collection_uq" ON "cart_items" USING btree ("cart_id","collection_id");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_one_target_ck" CHECK (("cart_items"."variant_id" IS NULL) <> ("cart_items"."collection_id" IS NULL));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
