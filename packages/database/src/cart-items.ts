import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { cartsTable } from "./carts.js";
import { collectionsTable } from "./collections.js";
import { productVariantsTable } from "./product-variants.js";

/**
 * A cart line is either one product variant or one whole collection (a
 * collection with sellAsWhole = true, sold as a bundle at its own price).
 * Exactly one of variant_id / collection_id is set.
 */
export const cartItemsTable = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => cartsTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariantsTable.id, {
      onDelete: "cascade",
    }),
    collectionId: uuid("collection_id").references(() => collectionsTable.id, {
      onDelete: "cascade",
    }),
    quantity: integer("quantity").notNull().default(1),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cart_items_cart_idx").on(t.cartId),
    uniqueIndex("cart_items_cart_variant_uq").on(t.cartId, t.variantId),
    uniqueIndex("cart_items_cart_collection_uq").on(t.cartId, t.collectionId),
    check("cart_items_one_target_ck", sql`(${t.variantId} IS NULL) <> (${t.collectionId} IS NULL)`),
  ],
);

export type CartItem = typeof cartItemsTable.$inferSelect;
export type NewCartItem = typeof cartItemsTable.$inferInsert;
