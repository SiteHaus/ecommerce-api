/**
 * DB-level integration tests for the variations reconcile.
 *
 * The unit tests around `diffVariants` prove the *pure* diff is right, but every
 * critical bug this feature shipped with lived in the seam between that diff and
 * Postgres: the option/value DELETE cascade silently truncating variant value-keys,
 * and retired (deactivated) variants colliding with live ones. Fakes cannot catch
 * those — only a real database with real ON DELETE CASCADE can. So these drive the
 * real VariationsSyncService against real Postgres.
 *
 * Requires a reachable Postgres. Set VARIATIONS_IT_DB_URL to override the default
 * local docker DSN; the suite creates and migrates its own scratch database, and
 * skips (loudly) if the server is unreachable.
 */
import { Pool } from "pg";
import {
  createDb,
  eq,
  orderItemsTable,
  ordersTable,
  productOptionValuesTable,
  productOptionsTable,
  productVariantsTable,
  productsTable,
  storesTable,
  variantOptionValuesTable,
  type Db,
} from "@sitehaus-ecom/database";
import { runMigrations } from "@sitehaus-ecom/database/migrate";
import { VariationsSyncService } from "./variations-sync.service";

const ADMIN_URL =
  process.env.VARIATIONS_IT_DB_URL ?? "postgres://ecom:ecom@localhost:5433/postgres";
const IT_DB = "variations_it";
const IT_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${IT_DB}`);

const audit = { log: jest.fn().mockResolvedValue(undefined) };

let pool: Pool;
let db: Db;
let service: VariationsSyncService;
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

/** Fresh product per test — isolation without tearing the schema down each time. */
async function newProduct(name = "Tee") {
  const [p] = await db.insert(productsTable).values({ storeId, name }).returning();
  return p.id;
}

/** The variant rows as the storefront would see them, plus their true value-keys. */
async function readVariants(productId: string) {
  const variants = await db.query.productVariantsTable.findMany({
    where: (v) => eq(v.productId, productId),
    orderBy: (v, { asc }) => [asc(v.createdAt), asc(v.id)],
  });
  const links = await db
    .select({
      variantId: variantOptionValuesTable.variantId,
      value: productOptionValuesTable.value,
      sortOrder: productOptionsTable.sortOrder,
    })
    .from(variantOptionValuesTable)
    .innerJoin(
      productOptionValuesTable,
      eq(variantOptionValuesTable.optionValueId, productOptionValuesTable.id),
    )
    .innerJoin(productOptionsTable, eq(productOptionValuesTable.optionId, productOptionsTable.id));

  return variants.map((v) => {
    const key: string[] = [];
    for (const l of links.filter((l) => l.variantId === v.id)) key[l.sortOrder] = l.value;
    return {
      id: v.id,
      name: v.name,
      isActive: v.isActive,
      priceCents: v.priceCents,
      values: key.filter((k) => k !== undefined),
    };
  });
}

/** Put a paid order against a variant so the reconcile is forbidden from deleting it. */
async function placeActiveOrder(variantId: string) {
  const [order] = await db
    .insert(ordersTable)
    .values({
      storeId,
      email: "buyer@example.com",
      subtotalCents: 1000,
      totalCents: 1000,
      status: "confirmed",
    })
    .returning();
  await db.insert(orderItemsTable).values({
    orderId: order.id,
    variantId,
    productName: "IT Product",
    variantName: "IT Variant",
    quantity: 1,
    unitPriceCents: 1000,
    totalCents: 1000,
  });
}

const row = (values: string[], priceCents = 1000, stock = 5) => ({ values, priceCents, stock });

describe("VariationsSyncService (real Postgres)", () => {
  beforeAll(async () => {
    if (!(await serverReachable())) {
      throw new Error(
        `Postgres unreachable at ${ADMIN_URL}. Start it (docker compose -f docker-compose.dev.yml up -d db) or set VARIATIONS_IT_DB_URL.`,
      );
    }
    const admin = new Pool({ connectionString: ADMIN_URL });
    await admin.query(`DROP DATABASE IF EXISTS ${IT_DB}`);
    await admin.query(`CREATE DATABASE ${IT_DB}`);
    await admin.end();

    await runMigrations(IT_URL);

    pool = new Pool({ connectionString: IT_URL });
    db = createDb(pool);
    service = new VariationsSyncService(db, audit as never);

    const [store] = await db
      .insert(storesTable)
      .values({ clientId: crypto.randomUUID(), name: "IT Store", slug: "it-store" })
      .returning();
    storeId = store.id;
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("creates one variant per combination, linked to its option values", async () => {
    const productId = await newProduct();
    await service.sync({
      productId,
      storeId,
      dimensions: [
        { name: "Size", values: ["S", "M"] },
        { name: "Color", values: ["Red"] },
      ],
      rows: [row(["S", "Red"]), row(["M", "Red"])],
    });

    const variants = await readVariants(productId);
    expect(variants).toHaveLength(2);
    // Set-wise: every variant is created in one transaction with the same createdAt and
    // sortOrder 0, so the DB imposes no meaningful order on them.
    expect(variants.map((v) => v.values).sort()).toEqual([
      ["M", "Red"],
      ["S", "Red"],
    ]);
    expect(variants.every((v) => v.isActive)).toBe(true);
  });

  // C1: reconciling options BEFORE snapshotting variants cascaded the Color links away,
  // truncating every key to its Size value. The diff then saw duplicates, collapsed them
  // in a Map, produced an empty toDelete — and left the dropped combinations alive and
  // sellable on the storefront.
  it("removing a dimension deletes the stranded combinations (C1)", async () => {
    const productId = await newProduct("Hoodie");
    await service.sync({
      productId,
      storeId,
      dimensions: [
        { name: "Size", values: ["S", "M"] },
        { name: "Color", values: ["Red", "Blue"] },
      ],
      rows: [row(["S", "Red"]), row(["S", "Blue"]), row(["M", "Red"]), row(["M", "Blue"])],
    });
    expect(await readVariants(productId)).toHaveLength(4);

    // Drop Color entirely -> only S and M should remain.
    await service.sync({
      productId,
      storeId,
      dimensions: [{ name: "Size", values: ["S", "M"] }],
      rows: [row(["S"]), row(["M"])],
    });

    const variants = await readVariants(productId);
    expect(variants).toHaveLength(2);
    expect(variants.map((v) => v.values).sort()).toEqual([["M"], ["S"]]);
    expect(variants.every((v) => v.isActive)).toBe(true);
  });

  // N1: a variant with active orders can't be hard-deleted, so it's deactivated. If it kept
  // its (post-cascade, truncated) option links it would carry a value-key that collides with
  // a LIVE variant's — and the next save could reactivate the corpse or, worse, push
  // isActive:false onto the live one.
  it("a variant blocked by an active order is retired without colliding with a live one (N1)", async () => {
    const productId = await newProduct("Cap");
    await service.sync({
      productId,
      storeId,
      dimensions: [
        { name: "Size", values: ["S"] },
        { name: "Color", values: ["Red", "Blue"] },
      ],
      rows: [row(["S", "Red"]), row(["S", "Blue"])],
    });
    const sRed = (await readVariants(productId)).find((v) => v.values.join() === "S,Red")!;
    await placeActiveOrder(sRed.id);

    // Collapse to a single Size dimension. S/Red can't be deleted (it has an order), so it
    // must be retired; its key would otherwise truncate to ["S"] and fight the new S variant.
    const first = await service.sync({
      productId,
      storeId,
      dimensions: [{ name: "Size", values: ["S"] }],
      rows: [row(["S"], 2500)],
    });
    expect(first.blocked).toHaveLength(1);
    expect(first.blocked[0].variantId).toBe(sRed.id);

    const retired = (await readVariants(productId)).find((v) => v.id === sRed.id)!;
    expect(retired.isActive).toBe(false);
    expect(retired.values).toEqual([]); // links stripped -> cannot collide

    // The live S variant is the one and only sellable row.
    const live = (await readVariants(productId)).filter((v) => v.isActive);
    expect(live).toHaveLength(1);
    expect(live[0].values).toEqual(["S"]);
    expect(live[0].priceCents).toBe(2500);

    // Save AGAIN — this is where the collision used to bite.
    await service.sync({
      productId,
      storeId,
      dimensions: [{ name: "Size", values: ["S"] }],
      rows: [row(["S"], 2600)],
    });

    const after = await readVariants(productId);
    const stillLive = after.filter((v) => v.isActive);
    expect(stillLive).toHaveLength(1); // not two: the corpse was NOT reactivated
    expect(stillLive[0].id).toBe(live[0].id);
    expect(stillLive[0].priceCents).toBe(2600);
    expect(after.find((v) => v.id === sRed.id)!.isActive).toBe(false); // corpse stays dead
  });

  // The nastiest N1 variant: collapsing to a PLAIN product. The retired variant's key
  // truncates to "[]" — exactly the plain row's key — so a Map could hand the plain row's
  // identity to the corpse and deactivate the only buyable variant.
  it("collapsing to a plain product leaves it buyable (N1, plain case)", async () => {
    const productId = await newProduct("Mug");
    await service.sync({
      productId,
      storeId,
      dimensions: [{ name: "Color", values: ["Red", "Blue"] }],
      rows: [row(["Red"]), row(["Blue"])],
    });
    const red = (await readVariants(productId)).find((v) => v.values.join() === "Red")!;
    await placeActiveOrder(red.id);

    // Remove ALL dimensions -> plain product with a single unnamed variant.
    await service.sync({ productId, storeId, dimensions: [], rows: [row([], 900, 3)] });

    const after = await readVariants(productId);
    const live = after.filter((v) => v.isActive);
    expect(live).toHaveLength(1);
    expect(live[0].values).toEqual([]);
    expect(live[0].priceCents).toBe(900);
    expect(after.find((v) => v.id === red.id)!.isActive).toBe(false);

    // And it survives a second save (the reactivate-the-corpse path).
    await service.sync({ productId, storeId, dimensions: [], rows: [row([], 950, 3)] });
    const final = await readVariants(productId);
    expect(final.filter((v) => v.isActive)).toHaveLength(1);
    expect(final.filter((v) => v.isActive)[0].priceCents).toBe(950);
  });

  // C2: the editor grid carries no compare-at field, so a blind `?? null` on update wiped
  // every sale price on the first save.
  it("does not wipe compareAtCents when the caller omits it (C2)", async () => {
    const productId = await newProduct("Sock");
    await service.sync({
      productId,
      storeId,
      dimensions: [{ name: "Size", values: ["S"] }],
      rows: [{ ...row(["S"], 1000), compareAtCents: 1500 }],
    });

    await service.sync({
      productId,
      storeId,
      dimensions: [{ name: "Size", values: ["S"] }],
      rows: [row(["S"], 1100)], // no compareAtCents
    });

    const [v] = await db.query.productVariantsTable.findMany({
      where: (v) => eq(v.productId, productId),
    });
    expect(v.priceCents).toBe(1100);
    expect(v.compareAtCents).toBe(1500); // preserved
  });

  // A rename keeps value-keys identical, so the variant survives as an UPDATE — but the
  // option/value rows are recreated under new ids, which used to leave it with dangling links.
  it("renaming a dimension keeps variants linked to the new option rows", async () => {
    const productId = await newProduct("Shirt");
    await service.sync({
      productId,
      storeId,
      dimensions: [{ name: "Size", values: ["S", "M"] }],
      rows: [row(["S"]), row(["M"])],
    });

    await service.sync({
      productId,
      storeId,
      dimensions: [{ name: "Fit", values: ["S", "M"] }],
      rows: [row(["S"]), row(["M"])],
    });

    const variants = await readVariants(productId);
    expect(variants).toHaveLength(2);
    expect(variants.map((v) => v.values).sort()).toEqual([["M"], ["S"]]);
    const options = await db.query.productOptionsTable.findMany({
      where: (o) => eq(o.productId, productId),
    });
    expect(options.map((o) => o.name)).toEqual(["Fit"]);
  });
});
