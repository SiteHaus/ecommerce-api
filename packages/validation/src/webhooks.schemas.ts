import { z } from "zod";

export const webhookEventSchema = z.enum([
  "order.confirmed",
  "order.shipped",
  "order.delivered",
  "order.refunded",
  "return.requested",
  "return.approved",
  "return.refunded",
  "inventory.low",
  "product.published",
]);

export const createWebhookEndpointSchema = z.object({
  url: z.string().url(),
  events: z.array(webhookEventSchema).min(1),
});

export const updateWebhookEndpointSchema = z
  .object({
    url: z.string().url().optional(),
    events: z.array(webhookEventSchema).min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "At least one field required",
  });

export const webhookEndpointSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  events: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const webhookEndpointWithSecretSchema = webhookEndpointSchema.extend({
  secret: z.string(),
});

export const webhookDeliverySchema = z.object({
  id: z.string().uuid(),
  endpointId: z.string().uuid(),
  event: z.string(),
  status: z.enum(["pending", "delivered", "failed"]),
  attemptCount: z.number(),
  lastAttemptAt: z.string().nullable(),
  responseStatus: z.number().nullable(),
  createdAt: z.string(),
});
