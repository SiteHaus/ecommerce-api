import { index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { storesTable } from "./stores.js";

export const storeAuditLogsTable = pgTable(
  "store_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id"), // SiteHaus userId; null for system/webhooks
    action: varchar("action", { length: 64 }).notNull(), // e.g. 'order.confirmed'
    targetType: varchar("target_type", { length: 32 }),
    targetId: uuid("target_id"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("store_audit_store_idx").on(t.storeId),
    index("store_audit_created_idx").on(t.createdAt),
  ],
);

export type StoreAuditLog = typeof storeAuditLogsTable.$inferSelect;
export type NewStoreAuditLog = typeof storeAuditLogsTable.$inferInsert;
