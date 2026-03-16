import { integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { collectionsTable } from "./collections.js";
import { productsTable } from "./products.js";

export const collectionProductsTable = pgTable(
  "collection_products",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collectionsTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.productId] })],
);

export type CollectionProduct = typeof collectionProductsTable.$inferSelect;
export type NewCollectionProduct = typeof collectionProductsTable.$inferInsert;
