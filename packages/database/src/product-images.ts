import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { productsTable } from "./products.js";
import { storesTable } from "./stores.js";

export const productImagesTable = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    cdnUrl: text("cdn_url").notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("images_product_idx").on(t.productId)],
);

export type ProductImage = typeof productImagesTable.$inferSelect;
export type NewProductImage = typeof productImagesTable.$inferInsert;
