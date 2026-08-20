import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import {
  and,
  asc,
  count,
  Db,
  eq,
  gt,
  inventoryTable,
  lte,
  productsTable,
  productVariantsTable,
  sql,
  storesTable,
} from "@sitehaus-ecom/database";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import type { ListInventoryQuery } from "@sitehaus-ecom/validation";
import type { Queue } from "bullmq";

@Injectable()
export class InventoryHandlerService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly audit: AuditService,
    @InjectQueue("ecom-webhooks") private readonly webhooksQueue: Queue,
    @InjectQueue("ecom-notifications") private readonly notificationsQueue: Queue,
  ) {}

  async get(variantId: string, storeId: string) {
    const variant = await this.db.query.productVariantsTable.findFirst({
      where: (v) => and(eq(v.id, variantId), eq(v.storeId, storeId)),
    });
    if (!variant) throw new NotFoundException("Variant not found");

    const [inv] = await this.db
      .select()
      .from(inventoryTable)
      .where(eq(inventoryTable.variantId, variantId))
      .limit(1);
    if (!inv) throw new NotFoundException("Inventory record not found");

    const [store] = await this.db
      .select({ reservationTtlMinutes: storesTable.reservationTtlMinutes })
      .from(storesTable)
      .where(eq(storesTable.id, storeId))
      .limit(1);

    return {
      variantId: inv.variantId,
      stock: inv.stock,
      reserved: inv.reserved,
      available: inv.stock - inv.reserved,
      allowBackorder: inv.allowBackorder,
      reservationTtlMinutes: store?.reservationTtlMinutes ?? 15,
      updatedAt: inv.updatedAt.toISOString(),
    };
  }

  async adjust(
    variantId: string,
    storeId: string,
    data: { stock?: number; allowBackorder?: boolean; reason?: string },
  ) {
    const variant = await this.db.query.productVariantsTable.findFirst({
      where: (v) => and(eq(v.id, variantId), eq(v.storeId, storeId)),
    });
    if (!variant) throw new NotFoundException("Variant not found");

    const [inv] = await this.db
      .select()
      .from(inventoryTable)
      .where(eq(inventoryTable.variantId, variantId))
      .limit(1);
    if (!inv) throw new NotFoundException("Inventory record not found");

    if (data.stock !== undefined && data.stock < inv.reserved) {
      throw new BadRequestException(
        `Stock cannot be less than current reservations (${inv.reserved} units reserved)`,
      );
    }

    const [updated] = await this.db
      .update(inventoryTable)
      .set({
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.allowBackorder !== undefined && {
          allowBackorder: data.allowBackorder,
        }),
      })
      .where(eq(inventoryTable.variantId, variantId))
      .returning();

    const [store] = await this.db
      .select({ reservationTtlMinutes: storesTable.reservationTtlMinutes })
      .from(storesTable)
      .where(eq(storesTable.id, storeId))
      .limit(1);

    await this.audit.log({
      storeId,
      action: "inventory.adjusted",
      targetType: "variant",
      targetId: variantId,
      meta: { from: inv.stock, to: updated.stock, ...(data.reason && { reason: data.reason }) },
    });

    const available = updated.stock - updated.reserved;
    if (data.stock !== undefined && available <= updated.lowStockThreshold) {
      void this.webhooksQueue.add("webhook.dispatch", {
        storeId,
        event: "inventory.low",
        data: { variantId, stock: updated.stock, reserved: updated.reserved, available },
      });
      // Fires on every manual adjustment that leaves stock at/below the threshold,
      // same as the webhook dispatch above — adjust() is an explicit admin action,
      // not a hot path, so a merchant re-touching already-low stock getting
      // reminded again is fine rather than something to suppress.
      void this.notificationsQueue.add(
        "inventory.low",
        {
          storeId,
          variantId,
          stock: updated.stock,
          reserved: updated.reserved,
          available,
          lowStockThreshold: updated.lowStockThreshold,
        },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
      );
    }

    return {
      variantId: updated.variantId,
      stock: updated.stock,
      reserved: updated.reserved,
      available,
      allowBackorder: updated.allowBackorder,
      reservationTtlMinutes: store?.reservationTtlMinutes ?? 15,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async list(storeId: string, query: ListInventoryQuery) {
    const { limit, offset, stockFilter, threshold } = query;

    const available = sql<number>`(${inventoryTable.stock} - ${inventoryTable.reserved})`;

    const conditions = [eq(inventoryTable.storeId, storeId)];
    if (stockFilter === "low") {
      conditions.push(gt(available, sql`0`), lte(available, sql`${threshold}`));
    } else if (stockFilter === "out") {
      conditions.push(lte(available, sql`0`));
    }

    const [items, totals] = await Promise.all([
      this.db
        .select({
          variantId: inventoryTable.variantId,
          productId: productVariantsTable.productId,
          productName: productsTable.name,
          variantName: productVariantsTable.name,
          sku: productVariantsTable.sku,
          stock: inventoryTable.stock,
          reserved: inventoryTable.reserved,
          available,
          allowBackorder: inventoryTable.allowBackorder,
        })
        .from(inventoryTable)
        .innerJoin(productVariantsTable, eq(productVariantsTable.id, inventoryTable.variantId))
        .innerJoin(productsTable, eq(productsTable.id, productVariantsTable.productId))
        .where(and(...conditions))
        .orderBy(asc(productsTable.name), asc(productVariantsTable.sortOrder))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(inventoryTable)
        .innerJoin(productVariantsTable, eq(productVariantsTable.id, inventoryTable.variantId))
        .innerJoin(productsTable, eq(productsTable.id, productVariantsTable.productId))
        .where(and(...conditions)),
    ]);

    return { items, total: totals[0]?.total ?? 0 };
  }
}
