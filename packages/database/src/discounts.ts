import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { storesTable } from "./stores.js";

export const discountTypeEnum = pgEnum("discount_type", [
  "percentage",
  "fixed_amount",
  "free_shipping",
]);

export const discountApplicabilityEnum = pgEnum("discount_applicability", [
  "order",
  "product",
  "collection",
]);

export const discountsTable = pgTable(
  "discounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: discountTypeEnum("type").notNull(),
    // Percentage (0–100) or fixed cents; null for free_shipping
    value: integer("value"),
    isAutomatic: boolean("is_automatic").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    applicability: discountApplicabilityEnum("applicability").notNull().default("order"),
    minOrderCents: integer("min_order_cents"),
    usageLimitTotal: integer("usage_limit_total"),
    usageLimitPerCustomer: integer("usage_limit_per_customer"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    // Stripe Coupon ID on the store's connected account — null for free_shipping type
    stripeCouponId: text("stripe_coupon_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("discounts_store_idx").on(t.storeId),
    index("discounts_active_idx").on(t.storeId, t.isActive, t.isAutomatic),
    // Partial unique — only enforced when stripeCouponId is not null (handled at app layer)
    index("discounts_stripe_coupon_idx").on(t.storeId, t.stripeCouponId),
  ],
);

export type Discount = typeof discountsTable.$inferSelect;
export type NewDiscount = typeof discountsTable.$inferInsert;
