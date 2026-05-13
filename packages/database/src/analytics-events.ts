import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores.js";

export const analyticsEventTypeEnum = pgEnum("analytics_event_type", [
  "product_viewed",
  "add_to_cart",
  "checkout_started",
  "order_completed",
]);

export const analyticsEventsTable = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull(),
    userId: uuid("user_id"),
    event: analyticsEventTypeEnum("event").notNull(),
    productId: uuid("product_id"),
    variantId: uuid("variant_id"),
    referrer: text("referrer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("analytics_events_store_created_idx").on(t.storeId, t.createdAt),
    index("analytics_events_store_event_idx").on(t.storeId, t.event),
  ],
);

export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEventsTable.$inferInsert;
