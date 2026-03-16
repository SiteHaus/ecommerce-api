import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { shippingZonesTable } from "./shipping-zones.js";

export const shippingRatesTable = pgTable(
  "shipping_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => shippingZonesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Standard", "Express"
    rateCents: integer("rate_cents").notNull(), // 0 = free
    minOrderCents: integer("min_order_cents"), // free shipping threshold; null = always this rate
    estimatedDays: integer("estimated_days"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("shipping_rates_zone_idx").on(t.zoneId)],
);

export type ShippingRate = typeof shippingRatesTable.$inferSelect;
export type NewShippingRate = typeof shippingRatesTable.$inferInsert;
