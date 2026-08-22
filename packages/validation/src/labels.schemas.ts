import { z } from "zod";

export const OriginAddress = z.object({
  originName: z.string().nullable(),
  originLine1: z.string().nullable(),
  originLine2: z.string().nullable(),
  originCity: z.string().nullable(),
  originState: z.string().nullable(),
  originZip: z.string().nullable(),
  originCountry: z.string().nullable(),
});

export const setOriginAddressSchema = z.object({
  originName: z.string().min(1),
  originLine1: z.string().min(1),
  originLine2: z.string().nullable().optional(),
  originCity: z.string().min(1),
  originState: z.string().min(1),
  originZip: z.string().min(1),
  originCountry: z.string().length(2),
});

export const ParcelPresetItem = z.object({
  id: z.string(),
  name: z.string(),
  lengthIn: z.number(),
  widthIn: z.number(),
  heightIn: z.number(),
  createdAt: z.string(),
});
export const ParcelPresetList = z.object({ items: z.array(ParcelPresetItem) });
export const createParcelPresetSchema = z.object({
  name: z.string().min(1),
  lengthIn: z.number().positive(),
  widthIn: z.number().positive(),
  heightIn: z.number().positive(),
});

export const RateItem = z.object({
  rateId: z.string(),
  carrier: z.string(),
  service: z.string(),
  amountCents: z.number(),
  estimatedDays: z.number().nullable(),
});
export const GetRatesResponse = z.object({ shipmentId: z.string(), rates: z.array(RateItem) });
export const GetRatesError = z.object({
  error: z.enum(["missing_weight", "billing_blocked", "not_found", "billing_setup_required"]),
  variants: z.array(z.object({ variantId: z.string(), variantName: z.string() })).optional(),
  setupUrl: z.string().optional(),
});

export const getRatesSchema = z.object({});

export const buyLabelSchema = z.object({ shipmentId: z.string(), rateId: z.string() });
export const BuyLabelResponse = z.object({
  orderId: z.string(),
  carrier: z.string(),
  service: z.string(),
  trackingCode: z.string(),
  labelUrl: z.string(),
});
export const BuyLabelError = z.object({
  error: z.enum(["billing_blocked", "not_found"]),
});

export const PostageBalance = z.object({
  availableCents: z.number(),
  pendingCents: z.number(),
});
export const LedgerEntryItem = z.object({
  id: z.string(),
  orderId: z.string(),
  amountCents: z.number(),
  type: z.enum(["charge", "refund"]),
  status: z.enum(["pending", "settled", "failed"]),
  createdAt: z.string(),
  settledAt: z.string().nullable(),
});
export const LedgerList = z.object({ items: z.array(LedgerEntryItem) });
