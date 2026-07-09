import { z } from "zod";

export const inventoryItem = z.object({
  variantId: z.string().uuid(),
  stock: z.number().int().min(0),
  reserved: z.number().int().min(0),
  available: z.number().int(),
  allowBackorder: z.boolean(),
  reservationTtlMinutes: z.number().int(),
  updatedAt: z.date(),
});

export const updateInventorySchema = z
  .object({
    stock: z.number().int().min(0).optional(),
    allowBackorder: z.boolean().optional(),
    reason: z.string().max(100).optional(),
  })
  .refine((data) => data.stock !== undefined || data.allowBackorder !== undefined, {
    message: "At least one field must be provided",
  });

export const inventoryVariantParam = z.object({
  variantId: z.string().uuid(),
});

export const bulkInventoryItem = z.object({
  variantId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  variantName: z.string(),
  sku: z.string().nullable(),
  stock: z.number().int().min(0),
  reserved: z.number().int().min(0),
  available: z.number().int(),
  allowBackorder: z.boolean(),
});

export const listInventoryQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
  stockFilter: z.enum(["all", "low", "out"]).default("all"),
  threshold: z.coerce.number().int().min(1).default(5),
});

export const listInventoryResponse = z.object({
  items: z.array(bulkInventoryItem),
  total: z.number().int(),
});

export type InventoryItem = z.infer<typeof inventoryItem>;
export type UpdateInventoryDto = z.infer<typeof updateInventorySchema>;
export type BulkInventoryItem = z.infer<typeof bulkInventoryItem>;
export type ListInventoryQuery = z.infer<typeof listInventoryQuery>;
export type ListInventoryResponse = z.infer<typeof listInventoryResponse>;
