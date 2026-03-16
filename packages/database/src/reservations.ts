import { index, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders.js";
import { productVariantsTable } from "./product-variants.js";
import { storesTable } from "./stores.js";

export const reservationsTable = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => ordersTable.id, {
      onDelete: "cascade",
    }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("reservations_variant_idx").on(t.variantId),
    index("reservations_order_idx").on(t.orderId),
    index("reservations_expires_idx").on(t.expiresAt),
  ],
);

export type Reservation = typeof reservationsTable.$inferSelect;
export type NewReservation = typeof reservationsTable.$inferInsert;
