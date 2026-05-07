import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores.js";

export const webhookEndpointsTable = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    // Raw secret used for HMAC-SHA256 signing — must stay plaintext for outbound signing
    secret: text("secret").notNull(),
    events: text("events").array().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("webhook_endpoints_store_idx").on(t.storeId)],
);

export type WebhookEndpoint = typeof webhookEndpointsTable.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpointsTable.$inferInsert;
