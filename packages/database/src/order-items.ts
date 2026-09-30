import { index, integer, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { collectionsTable } from "./collections.js";
import { ordersTable } from "./orders.js";
import { productVariantsTable } from "./product-variants.js";

export const orderItemsTable = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariantsTable.id, {
      onDelete: "set null",
    }),
    // Set when this line is a whole collection sold as a bundle (variantId is then null)
    collectionId: uuid("collection_id").references(() => collectionsTable.id, {
      onDelete: "set null",
    }),
    productName: text("product_name").notNull(), // snapshot at purchase time
    variantName: text("variant_name").notNull(), // snapshot at purchase time
    sku: varchar("sku", { length: 128 }),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(), // price at time of purchase
    totalCents: integer("total_cents").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export type OrderItem = typeof orderItemsTable.$inferSelect;
export type NewOrderItem = typeof orderItemsTable.$inferInsert;
