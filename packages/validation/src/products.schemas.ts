import { z } from "zod";
import { variantItem } from "./variants.schemas";

export const StatusEnum = z.enum(["draft", "active", "archived"]);
export type Status = z.infer<typeof StatusEnum>;

// ─── Shared building blocks ───────────────────────────────────────────────────

export const productIdParams = z.object({
  id: z.string().uuid(),
});

const variantPublic = z.object({
  id: z.string().uuid(),
  name: z.string(),
  priceCents: z.number().int(),
  compareAtCents: z.number().int().nullable(),
  availability: z.enum(["in_stock", "low_stock", "out_of_stock"]),
});

// ─── Admin schemas ────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: StatusEnum.default("draft"),
  goesLiveAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const updateProductSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    status: StatusEnum.optional(),
    goesLiveAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine(
    (data) =>
      Object.entries(data).some(
        ([key, value]) => key !== "id" && value !== undefined,
      ),
    { message: "At least one field must be provided" },
  );

export const adminQueryParams = z.object({
  status: StatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Public schemas ───────────────────────────────────────────────────────────

export const publicQueryParams = z.object({
  collectionId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Response shapes ──────────────────────────────────────────────────────────

export const productItem = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  primaryImage: z
    .object({
      cdnUrl: z.string(),
      altText: z.string().nullable().optional(),
    })
    .optional(),
  scheduled: z.boolean(),
  goesLiveAt: z.string().datetime({ offset: true }).nullable(),
  variants: z.array(variantItem),
});

export const productDetail = productItem.extend({
  variants: z.array(variantPublic).nullable(), // null when scheduled = true
});

export const productList = z.object({
  items: z.array(productItem),
  total: z.number().int(),
});

export const deleteProductResponse = z.object({
  message: z.string(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type ProductItem = z.infer<typeof productItem>;
export type ProductDetail = z.infer<typeof productDetail>;
export type ProductList = z.infer<typeof productList>;
export type PublicQueryParams = z.infer<typeof publicQueryParams>;
export type AdminQueryParams = z.infer<typeof adminQueryParams>;
