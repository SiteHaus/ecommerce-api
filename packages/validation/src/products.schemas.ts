import { z } from "zod";

export const StatusEnum = z.enum(["draft", "active", "archived"]);
export type Status = z.infer<typeof StatusEnum>;

export const productIdParams = z.object({
  id: z.string().uuid(),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: StatusEnum.default("draft"),
  goesLiveAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const adminQueryParams = z.object({
  status: StatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const publicQueryParams = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const variantPublic = z.object({
  id: z.string().uuid(),
  name: z.string(),
  priceCents: z.number().int(),
  compareAtCents: z.number().int().nullable(),
  availability: z.enum(["in_stock", "low_stock", "out_of_stock"]),
});

export const productItem = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: StatusEnum,
  goesLiveAt: z.string().nullable(),
  variantCount: z.number().int(),
  primaryImage: z.object({ cdnUrl: z.string(), altText: z.string().nullable() }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const variantAdmin = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string().nullable(),
  priceCents: z.number().int(),
  compareAtCents: z.number().int().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  availability: z.enum(["in_stock", "low_stock", "out_of_stock"]),
  stock: z.number().int(),
  reserved: z.number().int(),
});

export const productDetail = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: StatusEnum,
  goesLiveAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  variants: z.array(variantAdmin),
});

export const productList = z.object({
  items: z.array(productItem),
  total: z.number().int(),
});

export const deleteProductResponse = z.object({
  message: z.string(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type AdminQueryParams = z.infer<typeof adminQueryParams>;
export type PublicQueryParams = z.infer<typeof publicQueryParams>;
