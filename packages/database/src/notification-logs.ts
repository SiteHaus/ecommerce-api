import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";

export const notificationLogsTable = pgTable(
  "notification_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    recipientEmail: text("recipient_email").notNull(),
    event: varchar("event", { length: 64 }).notNull(), // e.g., "order.confirmed", "cart.abandoned"
    status: varchar("status", { length: 16 }).notNull(), // "sent" | "failed"
    resendMessageId: text("resend_message_id"), // Resend API message ID for tracking
    errorMessage: text("error_message"), // If status = failed
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notification_logs_store_event_idx").on(t.storeId, t.event, t.sentAt),
    index("notification_logs_recipient_idx").on(t.recipientEmail),
  ],
);

export type NotificationLog = typeof notificationLogsTable.$inferSelect;
export type NewNotificationLog = typeof notificationLogsTable.$inferInsert;
