import { index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { discountsTable } from "./discounts.js";

export const discountCodesTable = pgTable(
  "discount_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discountsTable.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    // Stripe PromotionCode ID on the store's connected account
    stripePromotionCodeId: text("stripe_promotion_code_id").notNull(),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discount_codes_discount_idx").on(t.discountId),
    // Code uniqueness enforced per discount (Stripe enforces per-account uniqueness too)
    unique("discount_codes_code_discount_unique").on(t.discountId, t.code),
  ],
);

export type DiscountCode = typeof discountCodesTable.$inferSelect;
export type NewDiscountCode = typeof discountCodesTable.$inferInsert;
