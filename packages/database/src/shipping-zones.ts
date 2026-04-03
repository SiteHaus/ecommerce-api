import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores.js";

export const shippingZonesTable = pgTable(
  "shipping_zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Domestic", "International"
    countries: jsonb("countries").$type<string[]>(), // ISO country codes; null = everywhere
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shipping_zones_store_idx").on(t.storeId)],
);

export type ShippingZone = typeof shippingZonesTable.$inferSelect;
export type NewShippingZone = typeof shippingZonesTable.$inferInsert;
