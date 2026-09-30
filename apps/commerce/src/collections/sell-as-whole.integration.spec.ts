/**
 * DB-level integration tests for collections sold as a whole (sellAsWhole).
 *
 * The cart and checkout unit tests fake the query builder, so they can't catch a
 * wrong join, a missing column or the cart_items "exactly one target" CHECK.
 * These drive the real cart, checkout and collection services against a real,
 * freshly migrated Postgres.
 *
 * Requires a reachable Postgres. Set SELL_AS_WHOLE_IT_DB_URL to override the
 * default local docker DSN; the suite creates and migrates its own scratch DB.
 */
import { Pool } from "pg";
import {
  cartItemsTable,
  collectionProductsTable,
  collectionsTable,
  createDb,
  eq,
  inventoryTable,
  orderItemsTable,
  productImagesTable,
  productsTable,
  productVariantsTable,
  reservationsTable,
  storesTable,
  type Db,
} from "@sitehaus-ecom/database";
import { runMigrations } from "@sitehaus-ecom/database/migrate";
import { CartHandlerService } from "../cart/cart-handler.service";
import { CheckoutService } from "../orders/checkout.service";
import { ReservationService } from "../inventory/reservation.service";
import { CollectionsHandlerService } from "./collections-handler.service";

const ADMIN_URL =
  process.env.SELL_AS_WHOLE_IT_DB_URL ?? "postgres://ecom:ecom@localhost:5433/postgres";
const IT_DB = "sell_as_whole_it";
const IT_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${IT_DB}`);

const audit = { log: jest.fn().mockResolvedValue(undefined) };

let pool: Pool;
let db: Db;
let cart: CartHandlerService;
let checkout: CheckoutService;
let collections: CollectionsHandlerService;
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

async function newProduct(name: string, priceCents: number, image?: string) {
  const [product] = await db
    .insert(productsTable)
    .values({ storeId, name, status: "active" })
    .returning();
  const [variant] = await db
    .insert(productVariantsTable)
    .values({ storeId, productId: product.id, name: "Default", priceCents })
    .returning();
  await db.insert(inventoryTable).values({ storeId, variantId: variant.id, stock: 5 });
  if (image) {
    await db
      .insert(productImagesTable)
      .values({ storeId, productId: product.id, r2Key: image, cdnUrl: `https://cdn/${image}` });
  }
  return { productId: product.id, variantId: variant.id };
}

async function newCollection(name: string, productIds: string[], priceCents = 4500) {
  const [c] = await db
    .insert(collectionsTable)
    .values({
      storeId,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      sellAsWhole: true,
      priceCents,
    })
    .returning();
  await db
    .insert(collectionProductsTable)
    .values(
      productIds.map((productId, sortOrder) => ({ collectionId: c.id, productId, sortOrder })),
    );
  return c.id;
}

const who = (sessionToken: string) => ({ storeId, sessionToken });

describe("Collections sold as a whole (real Postgres)", () => {
  beforeAll(async () => {
    if (!(await serverReachable())) {
      throw new Error(
        `Postgres unreachable at ${ADMIN_URL}. Start it (docker compose -f docker-compose.dev.yml up -d db) or set SELL_AS_WHOLE_IT_DB_URL.`,
      );
    }
    const admin = new Pool({ connectionString: ADMIN_URL });
    await admin.query(`DROP DATABASE IF EXISTS ${IT_DB}`);
    await admin.query(`CREATE DATABASE ${IT_DB}`);
    await admin.end();

    await runMigrations(IT_URL);

    pool = new Pool({ connectionString: IT_URL });
    db = createDb(pool);
    cart = new CartHandlerService(db);
    checkout = new CheckoutService(db, new ReservationService(db), audit as never);
    collections = new CollectionsHandlerService(db, audit as never);

    const [store] = await db
      .insert(storesTable)
      .values({ clientId: crypto.randomUUID(), name: "IT Store", slug: "it-store" })
      .returning();
    storeId = store.id;
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("blocks single photos, sells the collection as one line, and checks it out", async () => {
    const photo1 = await newProduct("Photo 1", 1500, "p1.jpg");
    const photo2 = await newProduct("Photo 2", 1500, "p2.jpg");
    const poster = await newProduct("Poster", 2000);
    const collectionId = await newCollection("Desert Bloom", [photo1.productId, photo2.productId]);

    await expect(cart.addItem(who("s1"), photo1.variantId, 1)).rejects.toThrow(
      '"Photo 1" is only sold as part of the "Desert Bloom" collection',
    );

    await cart.addItem(who("s1"), poster.variantId, 1);
    await cart.addCollection(who("s1"), collectionId);
    const current = await cart.addCollection(who("s1"), collectionId); // twice → still one line

    expect(current.items).toHaveLength(2);
    expect(current.items[1]).toMatchObject({
      type: "collection",
      collectionId,
      variantId: null,
      productName: "Desert Bloom",
      variantName: "Full collection",
      quantity: 1,
      priceCents: 4500,
      primaryImageUrl: "https://cdn/p1.jpg",
      availability: "in_stock",
    });
    expect(current.subtotalCents).toBe(2000 + 4500);

    const order = await checkout.createOrder({ ...who("s1"), email: "buyer@example.com" });
    expect(order.subtotalCents).toBe(6500);

    const lines = await db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.orderId));
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantId: poster.variantId,
          collectionId: null,
          totalCents: 2000,
        }),
        expect.objectContaining({
          variantId: null,
          collectionId,
          productName: "Desert Bloom",
          variantName: "Full collection",
          unitPriceCents: 4500,
        }),
      ]),
    );

    // Only the poster holds stock; the bundle reserves nothing
    const held = await db
      .select()
      .from(reservationsTable)
      .where(eq(reservationsTable.orderId, order.orderId));
    expect(held.map((r) => r.variantId)).toEqual([poster.variantId]);
  });

  it("refuses at checkout a single carted before the collection went whole-only", async () => {
    const photo = await newProduct("Photo 3", 1500);
    await cart.addItem(who("s2"), photo.variantId, 1); // allowed: not in a whole-only collection yet
    await newCollection("Canyon Light", [photo.productId]);

    await expect(checkout.createOrder({ ...who("s2"), email: "b@example.com" })).rejects.toThrow(
      "These items are only sold as part of a collection: Photo 3 (Canyon Light)",
    );
  });

  it("marks a carted collection unavailable and refuses it once it stops selling whole", async () => {
    const photo = await newProduct("Photo 4", 1500);
    const collectionId = await newCollection("Snow Canyon", [photo.productId]);
    await cart.addCollection(who("s3"), collectionId);

    await db
      .update(collectionsTable)
      .set({ sellAsWhole: false })
      .where(eq(collectionsTable.id, collectionId));

    const current = await cart.get(who("s3"));
    expect(current.items[0].availability).toBe("out_of_stock");
    await expect(checkout.createOrder({ ...who("s3"), email: "b@example.com" })).rejects.toThrow(
      "The following collections are no longer available: Snow Canyon",
    );
  });

  it("publishes sellAsWhole, price and cover image on the public collection list", async () => {
    const list = await collections.listPublic(storeId);
    expect(list.find((c) => c.name === "Desert Bloom")).toMatchObject({
      sellAsWhole: true,
      priceCents: 4500,
      coverImageUrl: "https://cdn/p1.jpg",
      productCount: 2,
    });
  });

  it("enforces exactly one of variant_id / collection_id on a cart line", async () => {
    const [{ id: cartId }] = await db
      .select({ id: cartItemsTable.cartId })
      .from(cartItemsTable)
      .limit(1);
    await expect(db.insert(cartItemsTable).values({ cartId, quantity: 1 })).rejects.toThrow();
  });
});
