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
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

export const inventoryVariantParam = z.object({
  variantId: z.string().uuid(),
});

export type InventoryItem = z.infer<typeof inventoryItem>;
export type UpdateInventoryDto = z.infer<typeof updateInventorySchema>;
