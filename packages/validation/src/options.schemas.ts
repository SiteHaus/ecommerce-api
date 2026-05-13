import { z } from "zod";

export const optionValueItem = z.object({
  id: z.string().uuid(),
  value: z.string(),
  sortOrder: z.number().int(),
});

export const optionItem = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number().int(),
  values: z.array(optionValueItem),
});

// Attached to variant responses — denormalised for frontend convenience
export const variantOptionValueRef = z.object({
  optionId: z.string().uuid(),
  optionName: z.string(),
  valueId: z.string().uuid(),
  value: z.string(),
});

export const optionProductParams = z.object({ productId: z.string().uuid() });
export const optionIdParams = z.object({ optionId: z.string().uuid() });
export const optionValueIdParams = z.object({ valueId: z.string().uuid() });

export const createOptionSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateOptionSchema = createOptionSchema
  .partial()
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

export const createOptionValueSchema = z.object({
  value: z.string().min(1),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateOptionValueSchema = createOptionValueSchema
  .partial()
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

export const deleteOptionResponse = z.object({ message: z.string() });

export type OptionItem = z.infer<typeof optionItem>;
export type OptionValueItem = z.infer<typeof optionValueItem>;
export type VariantOptionValueRef = z.infer<typeof variantOptionValueRef>;
export type CreateOptionDto = z.infer<typeof createOptionSchema>;
export type UpdateOptionDto = z.infer<typeof updateOptionSchema>;
export type CreateOptionValueDto = z.infer<typeof createOptionValueSchema>;
export type UpdateOptionValueDto = z.infer<typeof updateOptionValueSchema>;
