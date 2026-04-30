import { Injectable, NotFoundException } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import {
  collectionProductsTable,
  collectionsTable,
  Db,
  inventoryTable,
  productImagesTable,
  productOptionValuesTable,
  productOptionsTable,
  productsTable,
  productVariantsTable,
  variantOptionValuesTable,
} from "@sitehaus-ecom/database";
import { AuditService } from "@sitehaus-ecom/shared";
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  ReorderCollectionDto,
  DeleteCollectionDto,
  VerifyProductDto,
} from "@sitehaus-ecom/validation";
import { and, asc, eq, inArray, isNull, lte, or, sql } from "@sitehaus-ecom/database";
import { ConflictException } from "@nestjs/common";

@Injectable()
export class CollectionsHandlerService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async create(data: CreateCollectionDto & { storeId: string }) {
    const existing = await this.db
      .select()
      .from(collectionsTable)
      .where(and(eq(collectionsTable.storeId, data.storeId), eq(collectionsTable.slug, data.slug)))
      .limit(1);

    if (existing.length) throw new ConflictException("Slug already taken");

    const [collection] = await this.db
      .insert(collectionsTable)
      .values({
        storeId: data.storeId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        sortOrder: data.sortOrder,
        goesLiveAt: data.goesLiveAt ? new Date(data.goesLiveAt) : null,
      })
      .returning();

    return collection;
  }

  async delete(data: DeleteCollectionDto & { collectionId: string; storeId: string }) {
    const existing = await this.db
      .select()
      .from(collectionsTable)
      .where(
        and(eq(collectionsTable.storeId, data.storeId), eq(collectionsTable.id, data.collectionId)),
      )
      .limit(1);

    if (existing.length) {
      await this.db
        .delete(collectionsTable)
        .where(
          and(
            eq(collectionsTable.storeId, data.storeId),
            eq(collectionsTable.id, data.collectionId),
          ),
        );
      return { message: "Collection has been deleted!" };
    } else {
      throw new NotFoundException("Collection not found");
    }
  }

  async update(data: UpdateCollectionDto & { storeId: string; collectionId: string }) {
    const [oldCollection] = await this.db
      .select()
      .from(collectionsTable)
      .where(
        and(eq(collectionsTable.storeId, data.storeId), eq(collectionsTable.id, data.collectionId)),
      )
      .limit(1);

    if (!oldCollection) throw new NotFoundException("Collection not found");

    const { storeId, collectionId, goesLiveAt, ...rest } = data;
    const [updated] = await this.db
      .update(collectionsTable)
      .set({
        ...rest,
        ...(goesLiveAt !== undefined
          ? { goesLiveAt: goesLiveAt ? new Date(goesLiveAt) : null }
          : {}),
      })
      .where(and(eq(collectionsTable.storeId, storeId), eq(collectionsTable.id, collectionId)))
      .returning();

    return updated;
  }

  async reorder(data: ReorderCollectionDto & { collectionId: string; storeId: string }) {
    const [collection] = await this.db
      .select()
      .from(collectionsTable)
      .where(
        and(eq(collectionsTable.id, data.collectionId), eq(collectionsTable.storeId, data.storeId)),
      )
      .limit(1);

    if (!collection) throw new NotFoundException("Collection not found");

    await this.db.transaction(async (tx) => {
      for (const item of data.items) {
        await tx
          .update(collectionProductsTable)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(
              eq(collectionProductsTable.collectionId, data.collectionId),
              eq(collectionProductsTable.productId, item.productId),
            ),
          );
      }
    });
  }

  async list(storeId: string) {
    const now = new Date();
    const collections = await this.db
      .select()
      .from(collectionsTable)
      .where(
        and(
          eq(collectionsTable.storeId, storeId),
          or(isNull(collectionsTable.goesLiveAt), lte(collectionsTable.goesLiveAt, now)),
        ),
      )
      .orderBy(asc(collectionsTable.sortOrder));

    const ids = collections.map((c) => c.id);
    const counts =
      ids.length > 0
        ? await this.db
            .select({
              collectionId: collectionProductsTable.collectionId,
              count: sql<number>`count(*)::int`,
            })
            .from(collectionProductsTable)
            .where(inArray(collectionProductsTable.collectionId, ids))
            .groupBy(collectionProductsTable.collectionId)
        : [];

    const countMap = Object.fromEntries(counts.map((r) => [r.collectionId, r.count]));

    return collections.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      sortOrder: c.sortOrder,
      scheduled: c.goesLiveAt ? new Date(c.goesLiveAt) > now : false,
      goesLiveAt: c.goesLiveAt ?? null,
      productCount: countMap[c.id] ?? 0,
    }));
  }

  async getCollection(storeId: string, collectionId: string) {
    const [collection] = await this.db
      .select()
      .from(collectionsTable)
      .where(and(eq(collectionsTable.storeId, storeId), eq(collectionsTable.id, collectionId)))
      .limit(1);

    if (!collection) throw new NotFoundException("Collection not found");

    const products = await this.db
      .select({ id: collectionProductsTable.productId })
      .from(collectionProductsTable)
      .where(eq(collectionProductsTable.collectionId, collection.id));

    const now = new Date();
    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description ?? null,
      scheduled: collection.goesLiveAt ? new Date(collection.goesLiveAt) > now : false,
      goesLiveAt: collection.goesLiveAt ? new Date(collection.goesLiveAt) > now : null,
      products: products.map((p) => ({ id: p.id })),
    };
  }

  async listPublic(storeId: string) {
    const now = new Date();
    const collections = await this.db
      .select()
      .from(collectionsTable)
      .where(
        and(
          eq(collectionsTable.storeId, storeId),
          or(isNull(collectionsTable.goesLiveAt), lte(collectionsTable.goesLiveAt, now)),
        ),
      )
      .orderBy(asc(collectionsTable.sortOrder));

    const ids = collections.map((c) => c.id);
    const counts =
      ids.length > 0
        ? await this.db
            .select({
              collectionId: collectionProductsTable.collectionId,
              count: sql<number>`count(*)::int`,
            })
            .from(collectionProductsTable)
            .where(inArray(collectionProductsTable.collectionId, ids))
            .groupBy(collectionProductsTable.collectionId)
        : [];

    const countMap = Object.fromEntries(counts.map((r) => [r.collectionId, r.count]));

    return collections.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      productCount: countMap[c.id] ?? 0,
    }));
  }

  async getPublicCollection(storeId: string, slug: string) {
    const now = new Date();

    const [collection] = await this.db
      .select()
      .from(collectionsTable)
      .where(
        and(
          eq(collectionsTable.storeId, storeId),
          eq(collectionsTable.slug, slug),
          or(isNull(collectionsTable.goesLiveAt), lte(collectionsTable.goesLiveAt, now)),
        ),
      )
      .limit(1);

    if (!collection) throw new NotFoundException("Collection not found");

    const collectionProducts = await this.db
      .select({
        productId: collectionProductsTable.productId,
        sortOrder: collectionProductsTable.sortOrder,
      })
      .from(collectionProductsTable)
      .where(eq(collectionProductsTable.collectionId, collection.id))
      .orderBy(asc(collectionProductsTable.sortOrder));

    const productIds = collectionProducts.map((cp) => cp.productId);
    if (productIds.length === 0) {
      return {
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        description: collection.description ?? null,
        products: [],
        total: 0,
      };
    }

    const products = await this.db
      .select()
      .from(productsTable)
      .where(
        and(
          inArray(productsTable.id, productIds),
          eq(productsTable.status, "active"),
          or(isNull(productsTable.goesLiveAt), lte(productsTable.goesLiveAt, now)),
        ),
      );

    if (products.length === 0) {
      return {
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        description: collection.description ?? null,
        products: [],
        total: 0,
      };
    }

    const activeProductIds = products.map((p) => p.id);

    const [allImages, allVariants] = await Promise.all([
      this.db
        .select()
        .from(productImagesTable)
        .where(inArray(productImagesTable.productId, activeProductIds))
        .orderBy(asc(productImagesTable.sortOrder)),
      this.db
        .select({
          id: productVariantsTable.id,
          productId: productVariantsTable.productId,
          name: productVariantsTable.name,
          priceCents: productVariantsTable.priceCents,
          compareAtCents: productVariantsTable.compareAtCents,
          stock: inventoryTable.stock,
          reserved: inventoryTable.reserved,
          lowStockThreshold: inventoryTable.lowStockThreshold,
        })
        .from(productVariantsTable)
        .leftJoin(
          inventoryTable,
          and(
            eq(inventoryTable.variantId, productVariantsTable.id),
            eq(inventoryTable.storeId, storeId),
          ),
        )
        .where(inArray(productVariantsTable.productId, activeProductIds)),
    ]);

    const variantIds = allVariants.map((v) => v.id);
    const allVariantOptionValues =
      variantIds.length > 0
        ? await this.db
            .select({
              variantId: variantOptionValuesTable.variantId,
              valueId: productOptionValuesTable.id,
              value: productOptionValuesTable.value,
              optionId: productOptionsTable.id,
              optionName: productOptionsTable.name,
            })
            .from(variantOptionValuesTable)
            .innerJoin(
              productOptionValuesTable,
              eq(variantOptionValuesTable.optionValueId, productOptionValuesTable.id),
            )
            .innerJoin(
              productOptionsTable,
              eq(productOptionValuesTable.optionId, productOptionsTable.id),
            )
            .where(inArray(variantOptionValuesTable.variantId, variantIds))
        : [];

    const sortOrderMap = Object.fromEntries(
      collectionProducts.map((cp) => [cp.productId, cp.sortOrder]),
    );
    const sorted = [...products].sort(
      (a, b) => (sortOrderMap[a.id] ?? 0) - (sortOrderMap[b.id] ?? 0),
    );

    const items = sorted.map((p) => {
      const primaryImage = allImages.find((img) => img.productId === p.id) ?? null;
      const variants = allVariants.filter((v) => v.productId === p.id);
      return {
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        status: p.status,
        tags: p.tags,
        goesLiveAt: p.goesLiveAt?.toISOString() ?? null,
        primaryImage: primaryImage
          ? { cdnUrl: primaryImage.cdnUrl, altText: primaryImage.altText ?? null }
          : null,
        variants: variants.map((v) => ({
          id: v.id,
          name: v.name,
          priceCents: v.priceCents,
          compareAtCents: v.compareAtCents ?? null,
          availability: collectionAvailability({
            stock: v.stock ?? 0,
            reserved: v.reserved ?? 0,
            lowStockThreshold: v.lowStockThreshold ?? 5,
          }),
          optionValues: allVariantOptionValues
            .filter((ov) => ov.variantId === v.id)
            .map((ov) => ({
              optionId: ov.optionId,
              optionName: ov.optionName,
              valueId: ov.valueId,
              value: ov.value,
            })),
        })),
      };
    });

    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description ?? null,
      products: items,
      total: items.length,
    };
  }

  async verify(data: VerifyProductDto & { storeId: string; collectionId: string }) {
    const [collection] = await this.db
      .select()
      .from(collectionsTable)
      .where(
        and(eq(collectionsTable.id, data.collectionId), eq(collectionsTable.storeId, data.storeId)),
      )
      .limit(1);

    if (!collection) throw new NotFoundException("Collection not found");

    const [product] = await this.db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, data.productId), eq(productsTable.storeId, data.storeId)))
      .limit(1);

    if (!product) throw new NotFoundException("Product not found");

    await this.db
      .insert(collectionProductsTable)
      .values({ collectionId: collection.id, productId: product.id })
      .onConflictDoNothing();

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(collectionProductsTable)
      .where(eq(collectionProductsTable.collectionId, collection.id));

    const now = new Date();
    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description ?? null,
      sortOrder: collection.sortOrder,
      scheduled: collection.goesLiveAt ? new Date(collection.goesLiveAt) > now : false,
      goesLiveAt: collection.goesLiveAt ?? null,
      productCount: count,
    };
  }
}

function collectionAvailability(inventory: {
  stock: number;
  reserved: number;
  lowStockThreshold: number;
}): "in_stock" | "low_stock" | "out_of_stock" {
  const available = inventory.stock - inventory.reserved;
  if (available <= 0) return "out_of_stock";
  if (available <= inventory.lowStockThreshold) return "low_stock";
  return "in_stock";
}
