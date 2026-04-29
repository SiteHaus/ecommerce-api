import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { productImagesTable } from "./product-images.js";
import { productVariantsTable } from "./product-variants.js";

export const variantImagesTable = pgTable(
  "variant_images",
  {
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "cascade" }),
    imageId: uuid("image_id")
      .notNull()
      .references(() => productImagesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.variantId, t.imageId] })],
);

export type VariantImage = typeof variantImagesTable.$inferSelect;
export type NewVariantImage = typeof variantImagesTable.$inferInsert;
