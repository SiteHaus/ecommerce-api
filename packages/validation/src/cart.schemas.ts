import { z } from "zod";

export const availabilityEnum = z.enum(["in_stock", "low_stock", "out_of_stock"]);

export const cartItemSchema = z.object({
  variantId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  variantName: z.string(),
  sku: z.string().nullable(),
  priceCents: z.number().int(),
  compareAtCents: z.number().int().nullable(),
  primaryImageUrl: z.string().nullable(),
  quantity: z.number().int(),
  lineTotalCents: z.number().int(),
  availability: availabilityEnum,
});

export const cartSchema = z.object({
  id: z.string().uuid().nullable(),
  items: z.array(cartItemSchema),
  subtotalCents: z.number().int(),
  itemCount: z.number().int(),
  expiresAt: z.string().nullable(),
});

export const addCartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(999),
});

export const cartVariantParam = z.object({
  variantId: z.string().uuid(),
});

export type CartSchema = z.infer<typeof cartSchema>;
export type AddCartItemDto = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemDto = z.infer<typeof updateCartItemSchema>;
