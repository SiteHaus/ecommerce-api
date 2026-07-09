import { z } from "zod";
import { optionItem, variantOptionValueRef } from "./options.schemas.js";

export const StatusEnum = z.enum(["draft", "scheduled", "active", "archived"]);
export type Status = z.infer<typeof StatusEnum>;

export const ConditionEnum = z.enum(["new", "refurbished", "used"]);

export const productIdParams = z.object({
  id: z.string().uuid(),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: StatusEnum.default("draft"),
  goesLiveAt: z.string().datetime({ offset: true }).nullable().optional(),
  brand: z.string().optional(),
  gtin: z.string().max(14).optional(),
  mpn: z.string().optional(),
  condition: ConditionEnum.optional(),
  tags: z.array(z.string()).optional(),
});

export const updateProductSchema = createProductSchema.partial();
export const adminQueryParams = z.object({
  status: StatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const publicSortEnum = z.enum(["newest", "price_asc", "price_desc", "bestselling"]);

export const publicQueryParams = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().min(2).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  collectionId: z.string().uuid().optional(),
  availability: z.enum(["in_stock", "low_stock", "out_of_stock"]).optional(),
  sort: publicSortEnum.default("newest"),
  tags: z
    .string()
    .transform((v) =>
      v
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    )
    .optional(),
});

const variantPublic = z.object({
  id: z.string().uuid(),
  name: z.string(),
  priceCents: z.number().int(),
  compareAtCents: z.number().int().nullable(),
  availability: z.enum(["in_stock", "low_stock", "out_of_stock"]),
  optionValues: z.array(variantOptionValueRef),
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
  allowBackorder: z.boolean(),
  optionValues: z.array(variantOptionValueRef),
});

export const productDetail = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: StatusEnum,
  goesLiveAt: z.string().nullable(),
  brand: z.string().nullable(),
  gtin: z.string().nullable(),
  mpn: z.string().nullable(),
  condition: ConditionEnum,
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  options: z.array(optionItem),
  variants: z.array(variantAdmin),
});

export const productPublicDetail = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: StatusEnum,
  goesLiveAt: z.string().nullable(),
  tags: z.array(z.string()),
  primaryImage: z.object({ cdnUrl: z.string(), altText: z.string().nullable() }).nullable(),
  variants: z.array(variantPublic).nullable(),
});

export const productList = z.object({
  items: z.array(productItem),
  total: z.number().int(),
});

export const publicProductList = z.object({
  items: z.array(productPublicDetail),
  total: z.number().int(),
});

const productImage = z.object({ cdnUrl: z.string(), altText: z.string().nullable() });

export const publicProductDetailFull = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  brand: z.string().nullable(),
  tags: z.array(z.string()),
  scheduled: z.boolean(),
  goesLiveAt: z.string().nullable(),
  primaryImage: productImage.nullable(),
  images: z.array(productImage),
  options: z.array(optionItem),
  variants: z.array(variantPublic).nullable(),
});

export const deleteProductResponse = z.object({
  message: z.string(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = {
  id: string;
  name?: string;
  description?: string | null;
  status?: "draft" | "scheduled" | "active" | "archived";
  goesLiveAt?: string | null;
  brand?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  condition?: "new" | "refurbished" | "used";
  tags?: string[];
};
export type AdminQueryParams = z.infer<typeof adminQueryParams>;
export type PublicQueryParams = z.infer<typeof publicQueryParams>;
