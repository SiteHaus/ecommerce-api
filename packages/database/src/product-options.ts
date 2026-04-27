import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { productsTable } from "./products.js";

export const productOptionsTable = pgTable(
  "product_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Color", "Size"
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("options_product_idx").on(t.productId)],
);

export type ProductOption = typeof productOptionsTable.$inferSelect;
export type NewProductOption = typeof productOptionsTable.$inferInsert;
