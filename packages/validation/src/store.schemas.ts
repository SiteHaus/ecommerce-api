import { z } from "zod";

const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "slug may only contain lowercase letters, numbers, and hyphens");

// Merchant-facing toggles for the notification emails they receive. Keys mirror
// the `notification_preferences` jsonb column; an unset/true key means "send".
export const notificationPreferencesSchema = z
  .object({
    newOrder: z.boolean().optional(),
    returnRequested: z.boolean().optional(),
    lowStock: z.boolean().optional(),
    paymentFailed: z.boolean().optional(),
  })
  .nullable();

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
  notificationEmail: z.string().email().nullable().optional(),
  notificationPreferences: notificationPreferencesSchema.optional(),
  reservationTtlMinutes: z.number().int().min(5).max(60).optional(),
  fulfillmentType: z.enum(["shipping", "pickup"]).optional(),
});

export const storeItem = z.object({
  id: z.uuid(),
  clientId: z.uuid(),
  slug: z.string(),
  domain: z.string().nullable(),
  currency: z.string(),
  notificationEmail: z.string().email().nullable(),
  notificationPreferences: notificationPreferencesSchema,
  stripeAccountId: z.string().nullable(),
  stripeChargesEnabled: z.boolean(),
  stripePayoutsEnabled: z.boolean(),
  stripeDetailsSubmitted: z.boolean(),
  reservationTtlMinutes: z.number(),
  fulfillmentType: z.enum(["shipping", "pickup"]),
});

export const connectStripeSchema = z.object({
  returnUrl: z.string().url(),
});

export const connectStripeResponse = z.object({
  url: z.string().url(),
});

export const stripeStatusItem = z.object({
  connected: z.boolean(),
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  detailsSubmitted: z.boolean(),
});

export const accessibleStoresQuery = z.object({
  clientIds: z.string(),
});

export const accessibleStoreItem = z.object({
  id: z.uuid(),
  clientId: z.uuid(),
  slug: z.string(),
  name: z.string(),
});

export const accessibleStoresResponse = z.object({
  stores: z.array(accessibleStoreItem),
});

export type CreateStoreDto = z.infer<typeof createStoreSchema>;
export type UpdateStoreDto = z.infer<typeof updateStoreSchema>;
export type ConnectStripeDto = z.infer<typeof connectStripeSchema>;
