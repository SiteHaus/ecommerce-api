import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { productOptionsTable } from "./product-options.js";

export const productOptionValuesTable = pgTable(
  "product_option_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    optionId: uuid("option_id")
      .notNull()
      .references(() => productOptionsTable.id, { onDelete: "cascade" }),
    value: text("value").notNull(), // e.g. "Red", "Small"
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("option_values_option_idx").on(t.optionId)],
);

export type ProductOptionValue = typeof productOptionValuesTable.$inferSelect;
export type NewProductOptionValue = typeof productOptionValuesTable.$inferInsert;
