import { z } from "zod";

export const imageContentType = z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const productImageParams = z.object({
  id: z.string().uuid(),
});

export const productImageWithImageParams = z.object({
  id: z.string().uuid(),
  imageId: z.string().uuid(),
});

export const uploadUrlSchema = z.object({
  contentType: imageContentType,
});

export const confirmImageSchema = z.object({
  r2Key: z.string(),
  altText: z.string().optional(),
});

export const reorderImagesSchema = z.object({
  items: z.array(
    z.object({
      imageId: z.string().uuid(),
      sortOrder: z.number().int().min(0),
    }),
  ),
});

export const uploadUrlResponse = z.object({
  uploadUrl: z.string(),
  r2Key: z.string(),
  cdnUrl: z.string(),
});

export const productImageItem = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  storeId: z.string().uuid(),
  r2Key: z.string(),
  cdnUrl: z.string(),
  altText: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});

export const productImageList = z.array(productImageItem);

export const deleteImageResponse = z.object({
  message: z.string(),
});

export type UploadUrlDto = z.infer<typeof uploadUrlSchema>;
export type ConfirmImageDto = z.infer<typeof confirmImageSchema>;
export type ReorderImagesDto = z.infer<typeof reorderImagesSchema>;
export type ProductImageItem = z.infer<typeof productImageItem>;
