import { z } from "zod";

const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9-]+$/,
    "slug may only contain lowercase letters, numbers, and hyphens",
  );

export const createStoreSchema = z.object({
  name: z.string().min(1),
  slug: slugSchema,
  domain: z.string().optional(),
  currency: z.string().length(3).default("usd"),
  timezone: z.string().default("UTC"),
});

export const updateStoreSchema = z.object({
  name: z.string().min(1).optional(),
  slug: slugSchema.optional(),
  domain: z.string().nullable().optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  reservationTtlMinutes: z.number().int().min(5).max(60).optional(),
});

export const storeItem = z.object({
  id: z.uuid(),
  clientId: z.uuid(),
  slug: z.string(),
  domain: z.string().nullable(),
  currency: z.string(),
  stripeAccountId: z.string().nullable(),
  stripeChargesEnabled: z.boolean(),
  stripePayoutsEnabled: z.boolean(),
  stripeDetailsSubmitted: z.boolean(),
  reservationTtlMinutes: z.number(),
});

export type CreateStoreDto = z.infer<typeof createStoreSchema>;
export type UpdateStoreDto = z.infer<typeof updateStoreSchema>;
