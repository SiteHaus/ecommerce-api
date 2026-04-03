import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { productsTable } from "./products.js";
import { storesTable } from "./stores.js";

export const productVariantsTable = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    storeId: uuid("store_id") // denormalised for query speed
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Small / Red"
    sku: varchar("sku", { length: 128 }),
    priceCents: integer("price_cents").notNull(),
    compareAtCents: integer("compare_at_cents"), // strike-through price
    weightGrams: integer("weight_grams"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("variants_product_idx").on(t.productId),
    index("variants_store_idx").on(t.storeId),
    uniqueIndex("variants_sku_store_uq")
      .on(t.storeId, t.sku)
      .where(sql`${t.sku} IS NOT NULL`),
  ],
);

export type ProductVariant = typeof productVariantsTable.$inferSelect;
export type NewProductVariant = typeof productVariantsTable.$inferInsert;
