import { z } from "zod";

export const checkoutAddressSchema = z.object({
  name: z.string().min(1, "Name is required"),
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "Postal code is required"),
  country: z.string().length(2).default("CA"),
});

export const checkoutIntentRequestSchema = z.object({
  email: z.string().email("Valid email is required").optional(),
  address: checkoutAddressSchema.optional(),
  successUrl: z.string().url("Valid success URL is required"),
  cancelUrl: z.string().url("Valid cancel URL is required"),
  shippingRateId: z.string().uuid().optional(),
});

export const checkoutIntentResponseSchema = z.object({
  orderId: z.string().uuid(),
  checkoutUrl: z.string().url(),
  subtotalCents: z.number().int(),
  shippingCents: z.number().int(),
  totalCents: z.number().int(),
});
