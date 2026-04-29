import { z } from "zod";

export const discountTypeEnum = z.enum(["percentage", "fixed_amount", "free_shipping"]);
export const discountApplicabilityEnum = z.enum(["order", "product", "collection"]);

export const discountIdParams = z.object({ id: z.string().uuid() });
export const discountCodeIdParams = z.object({ codeId: z.string().uuid() });

export const createDiscountSchema = z
  .object({
    name: z.string().min(1),
    type: discountTypeEnum,
    // Required for percentage and fixed_amount; omit for free_shipping
    value: z.number().int().positive().optional(),
    isAutomatic: z.boolean().default(false),
    applicability: discountApplicabilityEnum.default("order"),
    minOrderCents: z.number().int().min(0).optional(),
    usageLimitTotal: z.number().int().positive().optional(),
    usageLimitPerCustomer: z.number().int().positive().optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).optional(),
  })
  .refine((d) => d.type === "free_shipping" || d.value !== undefined, {
    message: "value is required for percentage and fixed_amount discounts",
  });

export const updateDiscountSchema = z
  .object({
    name: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
    minOrderCents: z.number().int().min(0).nullable().optional(),
    usageLimitTotal: z.number().int().positive().nullable().optional(),
    usageLimitPerCustomer: z.number().int().positive().nullable().optional(),
    startsAt: z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

export const createDiscountCodeSchema = z.object({
  code: z.string().min(1).max(255).toUpperCase(),
});

// ── Response shapes ───────────────────────────────────────────────────────────

export const discountCodeItem = z.object({
  id: z.string().uuid(),
  code: z.string(),
  usageCount: z.number().int(),
  createdAt: z.string(),
});

export const discountItem = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: discountTypeEnum,
  value: z.number().int().nullable(),
  isAutomatic: z.boolean(),
  isActive: z.boolean(),
  applicability: discountApplicabilityEnum,
  minOrderCents: z.number().int().nullable(),
  usageLimitTotal: z.number().int().nullable(),
  usageLimitPerCustomer: z.number().int().nullable(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  codes: z.array(discountCodeItem),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const discountList = z.object({
  items: z.array(discountItem),
  total: z.number().int(),
});

export const deleteDiscountResponse = z.object({ message: z.string() });

// ── Stripe sync payloads (internal gateway → payments TCP messages) ─────────

export const stripeSyncCreateCouponPayload = z.object({
  storeId: z.string().uuid(),
  type: discountTypeEnum,
  value: z.number().int().positive().optional(),
  name: z.string(),
  usageLimitTotal: z.number().int().positive().optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
});

export const stripeSyncCreatePromoCodePayload = z.object({
  storeId: z.string().uuid(),
  stripeCouponId: z.string(),
  code: z.string(),
  usageLimitTotal: z.number().int().positive().optional(),
  minOrderCents: z.number().int().min(0).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
});

export type CreateDiscountDto = z.infer<typeof createDiscountSchema>;
export type UpdateDiscountDto = z.infer<typeof updateDiscountSchema>;
export type CreateDiscountCodeDto = z.infer<typeof createDiscountCodeSchema>;
export type DiscountItem = z.infer<typeof discountItem>;
