import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores.js";
import { ordersTable } from "./orders.js";

export const returnStatusEnum = pgEnum("return_status", [
  "requested",
  "approved",
  "rejected",
  "received",
  "refunded",
]);

export const returnsTable = pgTable(
  "returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    status: returnStatusEnum("status").notNull().default("requested"),
    reason: text("reason").notNull(),
    subReason: text("sub_reason"),
    customerNotes: text("customer_notes"),
    adminNotes: text("admin_notes"),
    refundedCents: integer("refunded_cents"),
    stripeRefundId: text("stripe_refund_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("returns_store_idx").on(t.storeId),
    index("returns_order_idx").on(t.orderId),
    index("returns_status_idx").on(t.storeId, t.status),
  ],
);

export type Return = typeof returnsTable.$inferSelect;
export type NewReturn = typeof returnsTable.$inferInsert;
