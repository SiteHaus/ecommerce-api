import { z } from "zod";

export const customerIdParams = z.object({ id: z.string().uuid() });

export const listCustomersQuery = z.object({
  search: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const updateCustomerSchema = z.object({
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

// ── Response shapes ───────────────────────────────────────────────────────────

export const customerItem = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  email: z.string(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  orderCount: z.number().int(),
  ltvCents: z.number().int(),
  lastOrderAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const orderSummary = z.object({
  id: z.string().uuid(),
  status: z.string(),
  subtotalCents: z.number().int(),
  totalCents: z.number().int(),
  currency: z.string(),
  trackingNumber: z.string().nullable(),
  createdAt: z.string(),
  confirmedAt: z.string().nullable(),
});

export const customerDetail = customerItem.extend({
  orders: z.array(orderSummary),
});

export const customerList = z.object({
  items: z.array(customerItem),
  total: z.number().int(),
});

export const myProfileResponse = z.object({
  id: z.string().uuid(),
  email: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(),
});

export const myOrdersResponse = z.object({
  items: z.array(orderSummary),
  total: z.number().int(),
});

export type ListCustomersQuery = z.infer<typeof listCustomersQuery>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
