import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const storesTable = pgTable(
  "stores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id").notNull(), // SiteHaus clientId — no FK (different DB)
    name: text("name").notNull(),
    slug: varchar("slug", { length: 64 }).notNull(),
    domain: text("domain"),
    stripeAccountId: text("stripe_account_id"),
    stripeChargesEnabled: boolean("stripe_charges_enabled").notNull().default(false),
    stripePayoutsEnabled: boolean("stripe_payouts_enabled").notNull().default(false),
    stripeDetailsSubmitted: boolean("stripe_details_submitted").notNull().default(false),
    currency: varchar("currency", { length: 3 }).notNull().default("usd"),
    timezone: text("timezone").notNull().default("UTC"),
    reservationTtlMinutes: integer("reservation_ttl_minutes").notNull().default(15),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("stores_client_idx").on(t.clientId),
    uniqueIndex("stores_slug_uq").on(t.slug),
    uniqueIndex("stores_domain_uq").on(t.domain),
  ],
);

export type Store = typeof storesTable.$inferSelect;
export type NewStore = typeof storesTable.$inferInsert;
