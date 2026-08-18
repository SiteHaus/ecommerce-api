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
    "abandoned",
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

const orderStatusEnum = z.enum([
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "failed",
  "refunded",
  "cancelled",
  "abandoned",
]);

export const adminOrderSummarySchema = z.object({
  id: z.string().uuid(),
  status: orderStatusEnum,
  email: z.string().email(),
  itemCount: z.number().int(),
  subtotalCents: z.number().int(),
  totalCents: z.number().int(),
  currency: z.string(),
  shippingCountry: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  createdAt: z.string(),
  confirmedAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
});

export const adminOrderDetailSchema = adminOrderSummarySchema.extend({
  shippingName: z.string().nullable(),
  shippingLine1: z.string().nullable(),
  shippingLine2: z.string().nullable(),
  shippingCity: z.string().nullable(),
  shippingState: z.string().nullable(),
  shippingZip: z.string().nullable(),
  shippingCents: z.number().int(),
  taxCents: z.number().int(),
  notes: z.string().nullable(),
  stripePaymentIntentId: z.string().nullable(),
  items: z.array(orderItemSchema),
});

export const adminOrderListSchema = z.object({
  items: z.array(adminOrderSummarySchema),
  total: z.number().int(),
});

export const shipOrderBodySchema = z.object({
  trackingNumber: z.string().min(1).max(100),
});

// Manual recovery path for orders that never captured a shipping address
// (see the shipping_address_collection fix) — a merchant fills this in after
// following up with the customer directly. Name + line1 are the minimum
// Stripe itself would require, so we hold orders to the same bar here.
export const updateShippingAddressBodySchema = z.object({
  name: z.string().min(1).max(200),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  zip: z.string().min(1).max(20),
});

export const adminListOrdersQuerySchema = z.object({
  status: z
    .union([orderStatusEnum, z.array(orderStatusEnum)])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
  email: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});
