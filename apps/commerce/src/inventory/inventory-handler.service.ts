import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import {
  and,
  Db,
  eq,
  inventoryTable,
  productVariantsTable,
  storesTable,
} from "@sitehaus-ecom/database";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import type { Queue } from "bullmq";

@Injectable()
export class InventoryHandlerService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly audit: AuditService,
    @InjectQueue("ecom-webhooks") private readonly webhooksQueue: Queue,
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
    data: { stock?: number; allowBackorder?: boolean },
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
      meta: { from: inv.stock, to: updated.stock },
    });

    const available = updated.stock - updated.reserved;
    if (data.stock !== undefined && available <= 0) {
      void this.webhooksQueue.add("webhook.dispatch", {
        storeId,
        event: "inventory.low",
        data: { variantId, stock: updated.stock, reserved: updated.reserved, available },
      });
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
}
