import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders.js";
import { storesTable } from "./stores.js";

export const postageLedgerTypeEnum = pgEnum("postage_ledger_type", ["charge", "refund"]);
export const postageLedgerStatusEnum = pgEnum("postage_ledger_status", [
  "pending",
  "settled",
  "failed",
]);

export const postageLedgerTable = pgTable(
  "postage_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    easypostShipmentId: text("easypost_shipment_id"),
    amountCents: integer("amount_cents").notNull(),
    type: postageLedgerTypeEnum("type").notNull(),
    status: postageLedgerStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [
    index("postage_ledger_store_idx").on(t.storeId),
    index("postage_ledger_status_idx").on(t.status),
  ],
);

export type PostageLedgerEntry = typeof postageLedgerTable.$inferSelect;
export type NewPostageLedgerEntry = typeof postageLedgerTable.$inferInsert;
