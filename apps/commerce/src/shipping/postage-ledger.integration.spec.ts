import { Pool } from "pg";
import { createDb, ordersTable, storesTable, type Db } from "@sitehaus-ecom/database";
import { runMigrations } from "@sitehaus-ecom/database/migrate";
import { PostageLedgerService } from "./postage-ledger.service";

const ADMIN_URL =
  process.env.POSTAGE_LEDGER_IT_DB_URL ?? "postgres://ecom:ecom@localhost:5433/postgres";
const IT_DB = "postage_ledger_it";
const IT_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${IT_DB}`);

let pool: Pool;
let db: Db;
let service: PostageLedgerService;
let storeId: string;

// `postage_ledger.order_id` is a NOT NULL FK to `orders.id`, so every charge in this
// suite needs a real order row behind it — a random UUID would violate the constraint.
async function insertOrder(): Promise<string> {
  const [order] = await db
    .insert(ordersTable)
    .values({ storeId, email: "buyer@example.com", subtotalCents: 1000, totalCents: 1000 })
    .returning();
  return order.id;
}

async function serverReachable() {
  const p = new Pool({ connectionString: ADMIN_URL, connectionTimeoutMillis: 2000 });
  try {
    await p.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await p.end();
  }
}

describe("PostageLedgerService (real Postgres)", () => {
  beforeAll(async () => {
    if (!(await serverReachable())) {
      throw new Error(
        `Postgres unreachable at ${ADMIN_URL}. Start it (docker compose -f docker-compose.dev.yml up -d db) or set POSTAGE_LEDGER_IT_DB_URL.`,
      );
    }
    const admin = new Pool({ connectionString: ADMIN_URL });
    await admin.query(`DROP DATABASE IF EXISTS ${IT_DB}`);
    await admin.query(`CREATE DATABASE ${IT_DB}`);
    await admin.end();

    await runMigrations(IT_URL);

    pool = new Pool({ connectionString: IT_URL });
    db = createDb(pool);
    service = new PostageLedgerService(db);

    const [store] = await db
      .insert(storesTable)
      .values({ clientId: crypto.randomUUID(), name: "IT Store", slug: "it-store" })
      .returning();
    storeId = store.id;
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("starts with the full $75 available when there are no charges", async () => {
    expect(await service.availableToSpendCents(storeId)).toBe(7500);
  });

  it("reduces available balance by exactly the charged amount", async () => {
    await service.recordCharge(storeId, await insertOrder(), "shp_1", 842);
    expect(await service.availableToSpendCents(storeId)).toBe(7500 - 842);
  });

  it("hits zero-or-below once cumulative pending charges reach the hard cap", async () => {
    await service.recordCharge(storeId, await insertOrder(), "shp_2", 7000);
    const available = await service.availableToSpendCents(storeId);
    expect(available).toBeLessThanOrEqual(0);
  });
});
