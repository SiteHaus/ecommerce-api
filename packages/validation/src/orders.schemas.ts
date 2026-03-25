import { z } from "zod";

export const orderItemSchema = z.object({
  productName: z.string(),
  variantName: z.string(),
  sku: z.string().nullable(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  totalCents: z.number().int(),
});

export const orderDetailSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    "pending",
    "confirmed",
    "shipped",
    "delivered",
    "failed",
    "refunded",
    "cancelled",
  ]),
  email: z.string().email(),
  createdAt: z.string(),
  confirmedAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  shipping: z.object({
    name: z.string(),
    line1: z.string(),
    line2: z.string().nullable(),
    city: z.string(),
    state: z.string().nullable(),
    zip: z.string(),
    country: z.string(),
  }),
  items: z.array(orderItemSchema),
  subtotalCents: z.number().int(),
  shippingCents: z.number().int(),
  taxCents: z.number().int(),
  totalCents: z.number().int(),
  currency: z.string(),
});

export const orderSummarySchema = orderDetailSchema.omit({ shipping: true, items: true });

export const orderListSchema = z.object({
  items: z.array(orderSummarySchema),
  total: z.number().int(),
});

export const getOrderQuerySchema = z.object({
  email: z.string().email().optional(),
});

export const listOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});
