import { index, integer, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { cartsTable } from "./carts.js";
import { productVariantsTable } from "./product-variants.js";

export const cartItemsTable = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => cartsTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cart_items_cart_idx").on(t.cartId),
    uniqueIndex("cart_items_cart_variant_uq").on(t.cartId, t.variantId),
  ],
);

export type CartItem = typeof cartItemsTable.$inferSelect;
export type NewCartItem = typeof cartItemsTable.$inferInsert;
