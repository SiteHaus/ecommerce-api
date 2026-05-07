import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { webhookEndpointsTable } from "./webhook-endpoints.js";

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending",
  "delivered",
  "failed",
]);

export const webhookDeliveriesTable = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpointsTable.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 64 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: webhookDeliveryStatusEnum("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("webhook_deliveries_endpoint_idx").on(t.endpointId),
    index("webhook_deliveries_status_idx").on(t.status),
    index("webhook_deliveries_created_idx").on(t.createdAt),
  ],
);

export type WebhookDelivery = typeof webhookDeliveriesTable.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveriesTable.$inferInsert;
