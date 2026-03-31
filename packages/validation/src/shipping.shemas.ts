import { z } from "zod";

export const createShippingZoneSchema = z.object({
  name: z.string(),
  countries: z.array(z.string()),
  sortOrder: z.number().optional(),
});

export const createShippingRateSchema = z.object({
  name: z.string(),
  rateCents: z.number(),
  minOrderCents: z.number().optional(),
  estimatedDays: z.number().optional(),
});

export const ShippingRateItem = z.object({
  id: z.string(),
  name: z.string(),
  rateCents: z.number(),
  minOrderCents: z.number().optional(),
  estimatedDays: z.number().optional(),
});
export const ShippingZoneItem = z.object({
  id: z.uuid(),
  name: z.string(),
  countries: z.array(z.string()),
  sortOrder: z.number(),
  rates: z.array(ShippingRateItem),
});

export const DeleteResponse = z.object({
  message: z.string(),
});

export const ShippingZoneList = z.object({
  items: z.array(ShippingZoneItem),
});

export const ShippingRateList = z.object({
  items: z.array(ShippingRateItem),
});

// In your validation package
export const shippingZoneParam = z.object({
  storeId: z.string(),
  zoneId: z.string(),
});

export const shippingParams = z.object({
  storeId: z.string(),
  zoneId: z.string(),
  rateId: z.string(),
});
export const shippingRateParam = z.object({
  rateId: z.uuid(),
  storeId: z.string(),
});

export const updateShippingZoneSchema = createShippingZoneSchema.partial();
export const updateShippingRateSchema = createShippingRateSchema.partial();

export type CreateShippingZoneDto = z.infer<typeof createShippingZoneSchema>;
export type CreateShippingRateDto = z.infer<typeof createShippingRateSchema>;
export type UpdateShippingZoneDto = z.infer<typeof updateShippingZoneSchema>;
export type UpdateShippingRateDto = z.infer<typeof updateShippingRateSchema>;
