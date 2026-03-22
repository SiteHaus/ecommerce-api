import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import { Inject } from "@nestjs/common";
import {
  Db,
  inventoryTable,
  orderItemsTable,
  ordersTable,
  productVariantsTable,
} from "@sitehaus-ecom/database";
import type { Redis } from "ioredis";
import { and, eq, notInArray } from "@sitehaus-ecom/database";

export const REDIS_TOKEN = "STORE_REDIS";

@Injectable()
export class VariantsHandlerService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    @Inject(REDIS_TOKEN) private readonly redis: Redis,

    private readonly audit: AuditService,
  ) {}

  async create(data: {
    productId: string;
    storeId: string;
    name: string;
    sku?: string;
    priceCents: number;
    compareAtCents?: number;
    weightGrams?: number;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const product = await this.db.query.productsTable.findFirst({
      where: (p) => and(eq(p.id, data.productId), eq(p.storeId, data.storeId)),
    });
    if (!product) throw new NotFoundException("Product not found.");

    if (data.sku) {
      const conflict = await this.db.query.productVariantsTable.findFirst({
        where: (v) => and(eq(v.sku, data.sku!), eq(v.storeId, data.storeId)),
      });

      if (conflict) throw new ConflictException("SKU already exists.");
    }

    const [variant] = await this.db
      .insert(productVariantsTable)
      .values({
        productId: data.productId,
        storeId: data.storeId,
        name: data.name,
        sku: data.sku,
        priceCents: data.priceCents,
        compareAtCents: data.compareAtCents,
        weightGrams: data.weightGrams,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
      })
      .returning();

    const [inv] = await this.db
      .insert(inventoryTable)
      .values({
        variantId: variant.id,
        storeId: data.storeId,
        stock: 0,
        reserved: 0,
      })
      .onConflictDoNothing()
      .returning();

    await this.audit.log({
      storeId: data.storeId,
      action: "variant.created",
      targetType: "variant",
      targetId: variant.id,
    });

    return {
      ...variant,
      inventory: inv,
    };
  }
  async update(data: {
    id: string;
    storeId: string;
    name?: string;
    sku?: string;
    priceCents?: number;
    compareAtCents?: number;
    weightGrams?: number;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    // verify variant belongs to store
    const existing = await this.db.query.productVariantsTable.findFirst({
      where: (v) => and(eq(v.id, data.id), eq(v.storeId, data.storeId)),
    });
    if (!existing) throw new NotFoundException("Variant not found");

    const [variant] = await this.db
      .update(productVariantsTable)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.priceCents !== undefined && { priceCents: data.priceCents }),
        ...(data.compareAtCents !== undefined && {
          compareAtCents: data.compareAtCents,
        }),
        ...(data.weightGrams !== undefined && {
          weightGrams: data.weightGrams,
        }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productVariantsTable.id, data.id),
          eq(productVariantsTable.storeId, data.storeId),
        ),
      )
      .returning();

    await this.audit.log({
      storeId: data.storeId,
      action: "variant.updated",
      targetType: "variant",
      targetId: data.id,
    });

    return variant;
  }

  async delete(data: { id: string; storeId: string }) {
    const existing = await this.db.query.productVariantsTable.findFirst({
      where: (v) => and(eq(v.id, data.id), eq(v.storeId, data.storeId)),
    });
    if (!existing) throw new NotFoundException("Variant not found");

    // Block if active orders exist
    const activeOrders = await this.db
      .select()
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(
        and(
          eq(orderItemsTable.variantId, data.id),
          notInArray(ordersTable.status, ["cancelled", "refunded", "failed"]),
        ),
      )
      .limit(1);

    if (activeOrders.length > 0) {
      throw new ConflictException(
        "Variant has active orders — deactivate instead of deleting",
      );
    }

    await this.db
      .delete(productVariantsTable)
      .where(
        and(
          eq(productVariantsTable.id, data.id),
          eq(productVariantsTable.storeId, data.storeId),
        ),
      );
    // inventory + cart_items cascade via FK

    await this.audit.log({
      storeId: data.storeId,
      action: "variant.deleted",
      targetType: "variant",
      targetId: data.id,
    });

    return { message: "The variant was successfully deleted" };
  }
}
