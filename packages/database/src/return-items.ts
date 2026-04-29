import { integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { returnsTable } from "./returns.js";
import { orderItemsTable } from "./order-items.js";

export const returnItemsTable = pgTable("return_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  returnId: uuid("return_id")
    .notNull()
    .references(() => returnsTable.id, { onDelete: "cascade" }),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItemsTable.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  refundCents: integer("refund_cents").notNull(),
});

export type ReturnItem = typeof returnItemsTable.$inferSelect;
export type NewReturnItem = typeof returnItemsTable.$inferInsert;
