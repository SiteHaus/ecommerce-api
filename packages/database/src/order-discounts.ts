import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { discountCodesTable } from "./discount-codes.js";
import { discountsTable } from "./discounts.js";
import { ordersTable } from "./orders.js";

export const orderDiscountsTable = pgTable(
  "order_discounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    // Nullable: discount may be deleted after purchase — snapshot preserves the record
    discountId: uuid("discount_id").references(() => discountsTable.id, {
      onDelete: "set null",
    }),
    discountCodeId: uuid("discount_code_id").references(() => discountCodesTable.id, {
      onDelete: "set null",
    }),
    // Snapshot of the code string at time of purchase (code row may be deleted later)
    codeUsed: text("code_used"),
    amountSavedCents: integer("amount_saved_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("order_discounts_order_idx").on(t.orderId),
    index("order_discounts_discount_idx").on(t.discountId),
  ],
);

export type OrderDiscount = typeof orderDiscountsTable.$inferSelect;
export type NewOrderDiscount = typeof orderDiscountsTable.$inferInsert;
