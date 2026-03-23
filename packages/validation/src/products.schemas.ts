import { z } from "zod";

export const StatusEnum = z.enum(["draft", "active", "archived"]);
export type Status = z.infer<typeof StatusEnum>;

export const productItem = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  primaryImage: z.string().optional(),
  scheduled: z.boolean(),
  status: StatusEnum,
  goesLiveAt: z.string().datetime({ offset: true }).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: StatusEnum,
  goesLiveAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const productIdParams = z.object({
  id: z.uuid(),
});

export const productList = z.object({
  items: z.array(productItem),
  total: z.number(),
});

export const adminQueryParams = z.object({
  status: z.string(),
  limit: z.number(),
  offset: z.number(),
});

export const publicQueryParams = z.object({
  collectionId: z.uuid(),
  limit: z.number(),
  offset: z.number(),
});

export const updateProductSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    status: StatusEnum,
    goesLiveAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

export const deleteProductSchema = z.object({
  message: z.string(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type ProductItem = z.infer<typeof productItem>;
