import { Injectable, NotFoundException } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import {
  collectionProductsTable,
  collectionsTable,
  Db,
  productsTable,
} from "@sitehaus-ecom/database";
import { AuditService } from "@sitehaus-ecom/shared";
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  ReorderCollectionDto,
  DeleteCollectionDto,
  VerifyProductDto,
} from "@sitehaus-ecom/validation";
import { and, eq, asc, sql, inArray, isNull, or, lte } from "@sitehaus-ecom/database";
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

  async getCollection(storeId: string, slug: string) {
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

    if (!collection) {
      throw new NotFoundException("Collection not found");
    }

    return collection;
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
