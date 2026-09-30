import {
  and,
  asc,
  collectionProductsTable,
  collectionsTable,
  type Db,
  eq,
  inArray,
  isNull,
  lte,
  or,
  productImagesTable,
  productsTable,
} from "@sitehaus-ecom/database";

/** variantName snapshot used for a whole-collection cart / order line. */
export const WHOLE_COLLECTION_VARIANT_NAME = "Full collection";

/**
 * Products that belong to at least one collection with sellAsWhole = true can
 * only be bought as part of that collection, never on their own.
 *
 * Returns productId → name of a sell-as-whole collection containing it.
 */
export async function findWholeOnlyProducts(
  db: Db,
  storeId: string,
  productIds: string[],
): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select({
      productId: collectionProductsTable.productId,
      collectionName: collectionsTable.name,
    })
    .from(collectionProductsTable)
    .innerJoin(collectionsTable, eq(collectionProductsTable.collectionId, collectionsTable.id))
    .where(
      and(
        eq(collectionsTable.storeId, storeId),
        eq(collectionsTable.sellAsWhole, true),
        inArray(collectionProductsTable.productId, productIds),
      ),
    );
  const map = new Map<string, string>();
  for (const r of rows) if (!map.has(r.productId)) map.set(r.productId, r.collectionName);
  return map;
}

/** A collection can be put in a cart / bought as a whole right now. */
export function isCollectionSellable(
  c: { sellAsWhole: boolean; priceCents: number | null; goesLiveAt: Date | null },
  now = new Date(),
): boolean {
  return c.sellAsWhole && !!c.priceCents && (!c.goesLiveAt || c.goesLiveAt <= now);
}

/** collectionId → cdnUrl of the first live product image, in collection order. */
export async function collectionCoverUrls(
  db: Db,
  collectionIds: string[],
): Promise<Map<string, string>> {
  if (collectionIds.length === 0) return new Map();
  const now = new Date();
  const rows = await db
    .selectDistinctOn([collectionProductsTable.collectionId], {
      collectionId: collectionProductsTable.collectionId,
      cdnUrl: productImagesTable.cdnUrl,
    })
    .from(collectionProductsTable)
    .innerJoin(productsTable, eq(collectionProductsTable.productId, productsTable.id))
    .innerJoin(
      productImagesTable,
      eq(productImagesTable.productId, collectionProductsTable.productId),
    )
    .where(
      and(
        inArray(collectionProductsTable.collectionId, collectionIds),
        eq(productsTable.status, "active"),
        or(isNull(productsTable.goesLiveAt), lte(productsTable.goesLiveAt, now)),
      ),
    )
    .orderBy(
      collectionProductsTable.collectionId,
      asc(collectionProductsTable.sortOrder),
      asc(productImagesTable.sortOrder),
    );
  return new Map(rows.map((r) => [r.collectionId, r.cdnUrl]));
}
