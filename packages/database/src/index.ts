export * from "./cart-items.js";
export * from "./customers.js";
export * from "./return-items.js";
export * from "./returns.js";
export * from "./store-return-settings.js";
export * from "./carts.js";
export * from "./collection-products.js";
export * from "./collections.js";
export * from "./discount-codes.js";
export * from "./discounts.js";
export * from "./inventory.js";
export * from "./order-discounts.js";
export * from "./order-items.js";
export * from "./orders.js";
export * from "./product-images.js";
export * from "./product-option-values.js";
export * from "./product-options.js";
export * from "./product-variants.js";
export * from "./products.js";
export * from "./reservations.js";
export * from "./shipping-rates.js";
export * from "./shipping-zones.js";
export * from "./store-audit-logs.js";
export * from "./stores.js";
export * from "./variant-images.js";
export * from "./variant-option-values.js";
export * from "./webhook-deliveries.js";
export * from "./webhook-endpoints.js";

export {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  notInArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  or,
  sql,
  max,
} from "drizzle-orm";

import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "./tables.js";

export const schema = tables;
export type Db = NodePgDatabase<typeof tables>;
export const createDb = (pool: Pool): Db => drizzle(pool, { schema: tables });
