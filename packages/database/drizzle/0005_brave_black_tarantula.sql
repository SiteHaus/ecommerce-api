ALTER TYPE "public"."product_status" ADD VALUE 'scheduled' BEFORE 'active';--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;