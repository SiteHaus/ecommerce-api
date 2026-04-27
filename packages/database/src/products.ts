import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { storesTable } from "./stores.js";

export const productStatusEnum = pgEnum("product_status", ["draft", "active", "archived"]);
export const productConditionEnum = pgEnum("product_condition", ["new", "refurbished", "used"]);

export const productsTable = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: productStatusEnum("status").notNull().default("draft"),
    goesLiveAt: timestamp("goes_live_at", { withTimezone: true }), // null = live immediately
    // Channel-required attributes (Google Merchant Center, Meta Commerce, TikTok Shop)
    brand: text("brand"),
    gtin: varchar("gtin", { length: 14 }), // barcode / UPC / EAN / ISBN
    mpn: text("mpn"), // manufacturer part number
    condition: productConditionEnum("condition").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("products_store_idx").on(t.storeId), index("products_status_idx").on(t.status)],
);

export type Product = typeof productsTable.$inferSelect;
export type NewProduct = typeof productsTable.$inferInsert;
