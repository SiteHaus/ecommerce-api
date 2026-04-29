import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores.js";

export const customersTable = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id"), // null for anonymous
    email: text("email").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    notes: text("notes"),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("customers_store_idx").on(t.storeId),
    index("customers_email_idx").on(t.storeId, t.email),
    uniqueIndex("customers_user_unique").on(t.storeId, t.userId),
  ],
);

export type Customer = typeof customersTable.$inferSelect;
export type NewCustomer = typeof customersTable.$inferInsert;
