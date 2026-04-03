import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { storesTable } from "./stores.js";

export const cartsTable = pgTable(
  "carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    sessionToken: varchar("session_token", { length: 128 }), // anonymous cart identifier
    userId: uuid("user_id"), // SiteHaus userId if authenticated
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("carts_store_session_uq")
      .on(t.storeId, t.sessionToken)
      .where(sql`${t.sessionToken} IS NOT NULL`),
    uniqueIndex("carts_store_user_uq")
      .on(t.storeId, t.userId)
      .where(sql`${t.userId} IS NOT NULL`),
    index("carts_expires_idx").on(t.expiresAt),
  ],
);

export type Cart = typeof cartsTable.$inferSelect;
export type NewCart = typeof cartsTable.$inferInsert;
