import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores.js";

export const parcelPresetsTable = pgTable(
  "parcel_presets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Small box", "Padded envelope"
    lengthIn: integer("length_in").notNull(),
    widthIn: integer("width_in").notNull(),
    heightIn: integer("height_in").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("parcel_presets_store_idx").on(t.storeId)],
);

export type ParcelPreset = typeof parcelPresetsTable.$inferSelect;
export type NewParcelPreset = typeof parcelPresetsTable.$inferInsert;
