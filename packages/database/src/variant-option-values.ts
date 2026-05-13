import { index, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { productOptionValuesTable } from "./product-option-values.js";
import { productVariantsTable } from "./product-variants.js";

export const variantOptionValuesTable = pgTable(
  "variant_option_values",
  {
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "cascade" }),
    optionValueId: uuid("option_value_id")
      .notNull()
      .references(() => productOptionValuesTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.variantId, t.optionValueId] }),
    index("vov_variant_idx").on(t.variantId),
  ],
);

export type VariantOptionValue = typeof variantOptionValuesTable.$inferSelect;
export type NewVariantOptionValue = typeof variantOptionValuesTable.$inferInsert;
