-- Adds 'abandoned' to order_status.
--
-- NOT via `ALTER TYPE ... ADD VALUE`: drizzle's migrator runs every pending migration
-- inside ONE transaction, and Postgres forbids *using* a value added to a pre-existing
-- enum until the adding transaction commits (55P04). The 0012 backfill would therefore
-- explode on any database where 0011 and 0012 are both pending — i.e. production.
--
-- That restriction is lifted for a type CREATED in the current transaction, so we rebuild
-- the type instead. Rebuilding also no-ops cleanly where 'abandoned' already exists, which
-- matters for envs that drifted ahead of the journal.
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."order_status" RENAME TO "order_status_old";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'shipped', 'delivered', 'failed', 'refunded', 'cancelled', 'abandoned');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "public"."order_status" USING "status"::text::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
DROP TYPE "public"."order_status_old";
