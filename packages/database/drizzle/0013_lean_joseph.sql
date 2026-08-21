ALTER TABLE "stores" ADD COLUMN "tax_registration_confirmed" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "stores" SET "tax_registration_confirmed" = true WHERE "slug" = 'onehealth';