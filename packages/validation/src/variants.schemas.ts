import { z } from "zod";

export const inventorySchema = z.object({
  id: z.string(),
  variantId: z.string(),
  stock: z.number().int().min(0),
  reserved: z.number().int().min(0),
});

export const variantItem = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  storeId: z.uuid(),
  name: z.string(),
  sku: z.string().nullable(),
  priceCents: z.number().int(),
  compareAtCents: z.number().int().nullable(),
  weightGrams: z.number().int().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  inventory: inventorySchema,
});

export const variantPathParams = z.object({
  productId: z.string().uuid(),
});

export const variantIdParams = z.object({
  id: z.string().uuid(),
});

export const deleteVariantSchema = z.object({
  message: z.string(),
});

export const createVariantSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  priceCents: z.number().int().min(1),
  compareAtCents: z.number().int().min(1).optional(),
  weightGrams: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateVariantSchema = z
  .object({
    name: z.string().min(1).optional(),
    sku: z.string().optional(),
    priceCents: z.number().int().min(1).optional(),
    compareAtCents: z.number().int().min(1).optional(),
    weightGrams: z.number().int().min(0).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

export type CreateVariantDto = z.infer<typeof createVariantSchema>;
export type UpdateVariantDto = z.infer<typeof updateVariantSchema>;
export type VariantItem = z.infer<typeof variantItem>;
