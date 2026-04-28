import { z } from "zod";

export const returnStatusEnum = z.enum([
  "requested",
  "approved",
  "rejected",
  "received",
  "refunded",
]);

export const returnIdParams = z.object({ id: z.string().uuid() });

// ── Return settings ────────────────────────────────────────────────────────────

const returnReasonSchema = z.object({
  reason: z.string().min(1),
  subReasons: z.array(z.string()).default([]),
});

export const returnSettingsResponse = z.object({
  returnWindowDays: z.number().int().positive(),
  autoApproveUnderCents: z.number().int().positive().nullable(),
  excludedProductIds: z.array(z.string().uuid()),
  returnReasons: z.array(returnReasonSchema),
});

export const updateReturnSettingsSchema = z.object({
  returnWindowDays: z.number().int().positive().optional(),
  autoApproveUnderCents: z.number().int().positive().nullable().optional(),
  excludedProductIds: z.array(z.string().uuid()).optional(),
  returnReasons: z.array(returnReasonSchema).optional(),
});

// ── Public: lookup + create ────────────────────────────────────────────────────

export const returnLookupRequest = z.object({
  orderId: z.string().uuid(),
  email: z.string().email(),
});

const eligibleItem = z.object({
  orderItemId: z.string().uuid(),
  productName: z.string(),
  variantName: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  totalCents: z.number().int(),
});

export const returnLookupResponse = z.object({
  orderId: z.string().uuid(),
  deliveredAt: z.string(),
  eligibleItems: z.array(eligibleItem),
  returnWindowDays: z.number().int(),
  returnReasons: z.array(returnReasonSchema),
});

const returnRequestItem = z.object({
  orderItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const createReturnSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().email(),
  reason: z.string().min(1),
  subReason: z.string().optional(),
  customerNotes: z.string().optional(),
  items: z.array(returnRequestItem).min(1),
});

// ── Response shapes ────────────────────────────────────────────────────────────

const returnItemResponse = z.object({
  id: z.string().uuid(),
  orderItemId: z.string().uuid(),
  productName: z.string(),
  variantName: z.string(),
  quantity: z.number().int(),
  refundCents: z.number().int(),
});

export const returnDetail = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  status: returnStatusEnum,
  reason: z.string(),
  subReason: z.string().nullable(),
  customerNotes: z.string().nullable(),
  adminNotes: z.string().nullable(),
  refundedCents: z.number().int().nullable(),
  items: z.array(returnItemResponse),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const returnList = z.object({
  items: z.array(returnDetail),
  total: z.number().int(),
});

export const listReturnsQuery = z.object({
  status: returnStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const adminNoteSchema = z.object({
  adminNotes: z.string().nullable().optional(),
});

export const deleteReturnResponse = z.object({ message: z.string() });

export type CreateReturnDto = z.infer<typeof createReturnSchema>;
export type UpdateReturnSettingsDto = z.infer<typeof updateReturnSettingsSchema>;
export type ListReturnsQuery = z.infer<typeof listReturnsQuery>;
