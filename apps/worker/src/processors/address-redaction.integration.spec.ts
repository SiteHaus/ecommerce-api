/**
 * DB-level integration tests for the street-address redaction cron.
 *
 * This job runs a destructive UPDATE against ~95 legacy orders that still carry a raw
 * street address (new orders never persist one — see the address-minimization work).
 * Mocking the DB proves nothing here: the entire risk is whether the WHERE clause
 * targets the right rows. Only a real Postgres, with real interval arithmetic, can
 * prove the 120-day dispute-window cutoff actually lands where we think it does.
 *
 * Requires a reachable Postgres. Set ADDRESS_REDACTION_IT_DB_URL to override the
 * default local docker DSN; the suite creates and migrates its own scratch database,
 * and skips (loudly) if the server is unreachable.
 */
import { Pool } from "pg";
import { createDb, eq, ordersTable, storesTable, type Db } from "@sitehaus-ecom/database";
import { runMigrations } from "@sitehaus-ecom/database/migrate";
import type { Job } from "bullmq";
import { AddressRedactionProcessor } from "./address-redaction.processor";

const ADMIN_URL =
  process.env.ADDRESS_REDACTION_IT_DB_URL ?? "postgres://ecom:ecom@localhost:5433/postgres";
const IT_DB = "address_redaction_it";
const IT_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${IT_DB}`);

let pool: Pool;
let db: Db;
let processor: AddressRedactionProcessor;
let storeId: string;

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

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function insertOrder(opts: {
  createdAt: Date;
  line1: string | null;
  line2?: string | null;
  city?: string;
}) {
  const [order] = await db
    .insert(ordersTable)
    .values({
      storeId,
      email: "buyer@example.com",
      status: "confirmed",
      subtotalCents: 1000,
      totalCents: 1000,
      shippingName: "Jamie Buyer",
      shippingLine1: opts.line1,
      shippingLine2: opts.line2 !== undefined ? opts.line2 : "Apt 2",
      shippingCity: opts.city ?? "Provo",
      shippingState: "UT",
      shippingZip: "84601",
      shippingCountry: "US",
      createdAt: opts.createdAt,
    })
    .returning();
  return order.id;
}

async function readOrder(id: string) {
  const [row] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  return row;
}

async function readLine1(id: string) {
  return (await readOrder(id)).shippingLine1;
}

async function readLine2(id: string) {
  return (await readOrder(id)).shippingLine2;
}

describe("AddressRedactionProcessor (real Postgres)", () => {
  beforeAll(async () => {
    if (!(await serverReachable())) {
      throw new Error(
        `Postgres unreachable at ${ADMIN_URL}. Start it (docker compose -f docker-compose.dev.yml up -d db) or set ADDRESS_REDACTION_IT_DB_URL.`,
      );
    }
    const admin = new Pool({ connectionString: ADMIN_URL });
    await admin.query(`DROP DATABASE IF EXISTS ${IT_DB}`);
    await admin.query(`CREATE DATABASE ${IT_DB}`);
    await admin.end();

    await runMigrations(IT_URL);

    pool = new Pool({ connectionString: IT_URL });
    db = createDb(pool);
    processor = new AddressRedactionProcessor(db);

    const [store] = await db
      .insert(storesTable)
      .values({ clientId: crypto.randomUUID(), name: "IT Store", slug: "it-store" })
      .returning();
    storeId = store.id;
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("skips orders whose street is already redacted, so the count stays meaningful", async () => {
    const alreadyRedacted = await insertOrder({
      createdAt: daysAgo(200),
      line1: null,
      line2: null,
    });
    const stillHasStreet = await insertOrder({ createdAt: daysAgo(200), line1: "9 Old Rd" });

    const result = await processor.process({ name: "address.redact", data: {} } as Job);

    expect(result.redacted).toBe(1); // only the one that still had a street
    expect(await readLine1(stillHasStreet)).toBeNull();
    expect(await readLine1(alreadyRedacted)).toBeNull(); // unchanged, and not double-counted
  });

  it("redacts only orders past the dispute window", async () => {
    const old = await insertOrder({ createdAt: daysAgo(121), line1: "9 Old Rd" });
    const edge = await insertOrder({ createdAt: daysAgo(119), line1: "8 Edge St" });
    const fresh = await insertOrder({ createdAt: daysAgo(1), line1: "1 New Ave" });

    await processor.process({ name: "address.redact", data: {} } as Job);

    expect(await readLine1(old)).toBeNull();
    expect(await readLine1(edge)).toBe("8 Edge St"); // still inside the window — untouchable
    expect(await readLine1(fresh)).toBe("1 New Ave");
  });

  it("redacts orders where only line2 still holds a street — the predicate is an OR, not an AND", async () => {
    const line2Only = await insertOrder({
      createdAt: daysAgo(200),
      line1: null,
      line2: "9 Old Rd",
    });

    await processor.process({ name: "address.redact", data: {} } as Job);

    expect(await readLine1(line2Only)).toBeNull();
    expect(await readLine2(line2Only)).toBeNull();
  });

  it("leaves city/state/zip/country alone — they are not the sensitive part", async () => {
    const old = await insertOrder({ createdAt: daysAgo(200), line1: "9 Old Rd", city: "Provo" });
    await processor.process({ name: "address.redact", data: {} } as Job);

    const row = await readOrder(old);
    expect(row.shippingLine1).toBeNull();
    expect(row.shippingCity).toBe("Provo");
    expect(row.shippingState).toBe("UT");
    expect(row.shippingZip).toBe("84601");
    expect(row.shippingCountry).toBe("US");
    expect(row.shippingName).not.toBeNull();
  });

  it("dry run reports what it would redact and changes nothing", async () => {
    const old = await insertOrder({ createdAt: daysAgo(200), line1: "9 Old Rd" });

    const result = await processor.process({
      name: "address.redact",
      data: { dryRun: true },
    } as Job);

    expect(result.wouldRedact).toBe(1);
    expect(await readLine1(old)).toBe("9 Old Rd"); // untouched
  });
});
