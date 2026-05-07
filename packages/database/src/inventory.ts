import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { productVariantsTable } from "./product-variants.js";
import { storesTable } from "./stores.js";

export const inventoryTable = pgTable(
  "inventory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    stock: integer("stock").notNull().default(0),
    reserved: integer("reserved").notNull().default(0), // count of active reservations
    allowBackorder: boolean("allow_backorder").notNull().default(false),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("inventory_variant_uq").on(t.variantId),
    index("inventory_store_idx").on(t.storeId),
  ],
);

export type Inventory = typeof inventoryTable.$inferSelect;
export type NewInventory = typeof inventoryTable.$inferInsert;
