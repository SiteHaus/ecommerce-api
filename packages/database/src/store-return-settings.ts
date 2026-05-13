import { integer, jsonb, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores.js";

export const storeReturnSettingsTable = pgTable(
  "store_return_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    returnWindowDays: integer("return_window_days").notNull().default(30),
    // null = no auto-approve; set to a value to auto-approve refunds under that amount
    autoApproveUnderCents: integer("auto_approve_under_cents"),
    // product IDs excluded from returns
    excludedProductIds: uuid("excluded_product_ids").array().notNull().default([]),
    // [{reason: string, subReasons: string[]}]
    returnReasons: jsonb("return_reasons").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("store_return_settings_store_uq").on(t.storeId)],
);

export type StoreReturnSettings = typeof storeReturnSettingsTable.$inferSelect;
