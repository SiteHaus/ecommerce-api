import { z } from "zod";

export const analyticsEventTypeSchema = z.enum([
  "product_viewed",
  "add_to_cart",
  "checkout_started",
  "order_completed",
]);

export const trackEventSchema = z.object({
  event: analyticsEventTypeSchema,
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  referrer: z.string().max(2048).optional(),
});

export const analyticsDateRangeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const revenueQuerySchema = analyticsDateRangeSchema.extend({
  period: z.enum(["day", "week", "month"]).default("day"),
});

export const revenuePeriodSchema = z.object({
  date: z.string(),
  revenue: z.number(),
  orderCount: z.number(),
  aov: z.number(),
});

export const revenueDashboardSchema = z.object({
  periods: z.array(revenuePeriodSchema),
});

export const topProductsQuerySchema = analyticsDateRangeSchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const topProductsByRevenueItemSchema = z.object({
  productId: z.string().uuid(),
  name: z.string(),
  revenue: z.number(),
});

export const topProductsByViewsItemSchema = z.object({
  productId: z.string().uuid().nullable(),
  name: z.string().nullable(),
  views: z.number(),
});

export const topProductsDashboardSchema = z.object({
  byRevenue: z.array(topProductsByRevenueItemSchema),
  byViews: z.array(topProductsByViewsItemSchema),
});

export const funnelStageSchema = z.object({
  stage: analyticsEventTypeSchema,
  count: z.number(),
  conversionRate: z.number().nullable(),
});

export const funnelSchema = z.object({
  stages: z.array(funnelStageSchema),
});

export const abandonedCartsSchema = z.object({
  totalCartsWithItems: z.number(),
  abandoned: z.number(),
  abandonedRate: z.number(),
});

export const abandonedCartRowSchema = z.object({
  cartId: z.string().uuid(),
  itemCount: z.number().int(),
  estimatedValueCents: z.number().int(),
  createdAt: z.string(),
  lastActivityAt: z.string(),
  isAnonymous: z.boolean(),
});

export const abandonedCartsListSchema = z.object({
  items: z.array(abandonedCartRowSchema),
  total: z.number().int(),
});

export const abandonedCartsListQuerySchema = analyticsDateRangeSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type AbandonedCartRow = z.infer<typeof abandonedCartRowSchema>;
