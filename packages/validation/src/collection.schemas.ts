import { z } from "zod";
import { productPublicDetail } from "./products.schemas.js";

export const collectionItem = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  scheduled: z.boolean(),
  goesLiveAt: z.date().nullable(),
  productCount: z.number(),
});

export const collectionIdParams = z.object({
  id: z.uuid(),
});

export const slugParams = z.object({
  slug: z.string(),
});

// Keep old export name for contract compatibility
export const slugIdParams = slugParams;

export const createCollectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  sortOrder: z.number().optional(),
  goesLiveAt: z.string().datetime().nullable().optional(),
});

export const collectionListItem = z.object({
  productId: z.string(),
  sortOrder: z.number(),
});

export const collectionListSchema = z.object({
  collections: z.array(collectionItem),
});

export const publicCollectionListSchema = z.object({
  collections: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
      description: z.string().nullable(),
      productCount: z.number(),
    }),
  ),
});

export const collectionDetail = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  slug: z.string(),
  scheduled: z.boolean(),
  goesLiveAt: z.boolean().nullable(),
  products: z.array(z.object({ id: z.string() })),
});

export const publicCollectionDetail = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  products: z.array(productPublicDetail),
  total: z.number().int(),
});

export const reorderCollectionSchema = z.object({
  items: z.array(collectionListItem),
});

export const deleteCollectionResponse = z.object({
  message: z.string(),
});

export const deleteCollectionSchema = z.object({
  id: z.uuid(),
});

export const verifyProduct = z.object({
  productId: z.uuid(),
});

export const updateCollectionSchema = createCollectionSchema.partial();

export type UpdateCollectionDto = z.infer<typeof updateCollectionSchema>;
export type CollectionItem = z.infer<typeof collectionItem>;
export type CreateCollectionDto = z.infer<typeof createCollectionSchema>;
export type DeleteCollectionDto = z.infer<typeof deleteCollectionSchema>;
export type VerifyProductDto = z.infer<typeof verifyProduct>;
export type ReorderCollectionDto = z.infer<typeof reorderCollectionSchema>;
