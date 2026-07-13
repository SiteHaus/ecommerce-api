import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { Inject } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { DB_TOKEN, AuditService } from "@sitehaus-ecom/shared";
import {
  orderItemsTable,
  ordersTable,
  returnItemsTable,
  returnsTable,
  storeReturnSettingsTable,
  type Db,
} from "@sitehaus-ecom/database";
import { and, eq, sql } from "@sitehaus-ecom/database";
import type {
  CreateReturnDto,
  ListReturnsQuery,
  UpdateReturnSettingsDto,
} from "@sitehaus-ecom/validation";

@Injectable()
export class ReturnsHandlerService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly audit: AuditService,
    @InjectQueue("ecom-notifications") private readonly notificationsQueue: Queue,
    @InjectQueue("ecom-returns") private readonly returnsQueue: Queue,
  ) {}

  // ── Settings ────────────────────────────────────────────────────────────────

  async getSettings(storeId: string) {
    const settings = await this.db.query.storeReturnSettingsTable.findFirst({
      where: eq(storeReturnSettingsTable.storeId, storeId),
    });
    if (settings) return this.formatSettings(settings);

    // Upsert defaults on first access
    const [created] = await this.db
      .insert(storeReturnSettingsTable)
      .values({ storeId })
      .onConflictDoNothing()
      .returning();
    return this.formatSettings(
      created ?? {
        returnWindowDays: 30,
        autoApproveUnderCents: null,
        excludedProductIds: [],
        returnReasons: [],
      },
    );
  }

  async updateSettings(storeId: string, data: UpdateReturnSettingsDto) {
    await this.db
      .insert(storeReturnSettingsTable)
      .values({ storeId, ...data })
      .onConflictDoUpdate({
        target: storeReturnSettingsTable.storeId,
        set: {
          ...(data.returnWindowDays !== undefined && { returnWindowDays: data.returnWindowDays }),
          ...(data.autoApproveUnderCents !== undefined && {
            autoApproveUnderCents: data.autoApproveUnderCents,
          }),
          ...(data.excludedProductIds !== undefined && {
            excludedProductIds: data.excludedProductIds,
          }),
          ...(data.returnReasons !== undefined && { returnReasons: data.returnReasons }),
          updatedAt: new Date(),
        },
      });

    return this.getSettings(storeId);
  }

  // ── Public: lookup + create ─────────────────────────────────────────────────

  async lookupOrder(storeId: string, orderId: string, email: string) {
    const order = await this.db.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.storeId, storeId)),
    });

    if (!order || order.email.toLowerCase() !== email.toLowerCase()) {
      throw new NotFoundException("Order not found");
    }

    if (order.status !== "delivered") {
      throw new RpcException({
        status: 400,
        message: "Order must be delivered before a return can be requested",
      });
    }

    if (!order.deliveredAt) {
      throw new RpcException({ status: 400, message: "Order delivery date not recorded" });
    }

    const settings = await this.getSettings(storeId);
    const windowExpiry = new Date(order.deliveredAt);
    windowExpiry.setDate(windowExpiry.getDate() + settings.returnWindowDays);

    if (new Date() > windowExpiry) {
      throw new RpcException({
        status: 400,
        message: `Return window of ${settings.returnWindowDays} days has expired`,
      });
    }

    const items = await this.db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, orderId));

    // Exclude items whose product was excluded in settings
    const eligible = settings.excludedProductIds.length
      ? items // filtering by productId would need a join; skip for v1 — all items eligible
      : items;

    return {
      orderId: order.id,
      deliveredAt: order.deliveredAt.toISOString(),
      returnWindowDays: settings.returnWindowDays,
      returnReasons: settings.returnReasons as { reason: string; subReasons: string[] }[],
      eligibleItems: eligible.map((i) => ({
        orderItemId: i.id,
        productName: i.productName,
        variantName: i.variantName,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        totalCents: i.totalCents,
      })),
    };
  }

  async createReturn(storeId: string, data: CreateReturnDto) {
    // Validate the order belongs to this store and email matches
    const order = await this.db.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, data.orderId), eq(ordersTable.storeId, storeId)),
    });

    if (!order || order.email.toLowerCase() !== data.email.toLowerCase()) {
      throw new NotFoundException("Order not found");
    }

    if (order.status !== "delivered") {
      throw new RpcException({
        status: 400,
        message: "Order must be delivered to request a return",
      });
    }

    // Prevent duplicate pending return
    const existing = await this.db.query.returnsTable.findFirst({
      where: and(
        eq(returnsTable.orderId, data.orderId),
        eq(returnsTable.storeId, storeId),
        sql`${returnsTable.status} NOT IN ('rejected', 'refunded')`,
      ),
    });
    if (existing) throw new ConflictException("A return is already in progress for this order");

    // Fetch order items to compute refund amounts
    const orderItems = await this.db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, data.orderId));

    const itemMap = Object.fromEntries(orderItems.map((i) => [i.id, i]));

    for (const item of data.items) {
      const orderItem = itemMap[item.orderItemId];
      if (!orderItem) throw new NotFoundException(`Order item ${item.orderItemId} not found`);
      if (item.quantity > orderItem.quantity) {
        throw new RpcException({
          status: 400,
          message: `Cannot return more than purchased quantity for ${orderItem.productName}`,
        });
      }
    }

    const settings = await this.getSettings(storeId);
    const totalRefundCents = data.items.reduce((sum, item) => {
      const orderItem = itemMap[item.orderItemId];
      return sum + Math.round(orderItem!.unitPriceCents * item.quantity);
    }, 0);

    // Auto-approve if under threshold
    const autoApprove =
      settings.autoApproveUnderCents !== null && totalRefundCents <= settings.autoApproveUnderCents;

    const [ret] = await this.db
      .insert(returnsTable)
      .values({
        storeId,
        orderId: data.orderId,
        status: autoApprove ? "approved" : "requested",
        reason: data.reason,
        subReason: data.subReason,
        customerNotes: data.customerNotes,
      })
      .returning();

    const itemRows = data.items.map((item) => ({
      returnId: ret.id,
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      refundCents: Math.round(itemMap[item.orderItemId]!.unitPriceCents * item.quantity),
    }));

    await this.db.insert(returnItemsTable).values(itemRows);

    await this.audit.log({
      storeId,
      action: autoApprove ? "return.auto_approved" : "return.requested",
      targetType: "return",
      targetId: ret.id,
    });

    void this.notificationsQueue.add(
      "order.return_requested",
      { orderId: data.orderId, storeId, returnReason: data.reason },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        jobId: `order.return_requested:${ret.id}`,
      },
    );

    return this.getReturn(storeId, ret.id);
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  async list(storeId: string, query: ListReturnsQuery) {
    const where = and(
      eq(returnsTable.storeId, storeId),
      query.status ? eq(returnsTable.status, query.status) : undefined,
    );

    const [[{ total }], returns] = await Promise.all([
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(returnsTable)
        .where(where),
      this.db
        .select()
        .from(returnsTable)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(returnsTable.createdAt),
    ]);

    const items = await Promise.all(returns.map((r) => this.getReturn(storeId, r.id)));
    return { items, total };
  }

  async getReturn(storeId: string, id: string) {
    const ret = await this.db.query.returnsTable.findFirst({
      where: and(eq(returnsTable.id, id), eq(returnsTable.storeId, storeId)),
    });
    if (!ret) throw new NotFoundException("Return not found");

    const items = await this.db
      .select({
        id: returnItemsTable.id,
        orderItemId: returnItemsTable.orderItemId,
        productName: orderItemsTable.productName,
        variantName: orderItemsTable.variantName,
        quantity: returnItemsTable.quantity,
        refundCents: returnItemsTable.refundCents,
      })
      .from(returnItemsTable)
      .innerJoin(orderItemsTable, eq(returnItemsTable.orderItemId, orderItemsTable.id))
      .where(eq(returnItemsTable.returnId, ret.id));

    return {
      id: ret.id,
      orderId: ret.orderId,
      status: ret.status,
      reason: ret.reason,
      subReason: ret.subReason,
      customerNotes: ret.customerNotes,
      adminNotes: ret.adminNotes,
      refundedCents: ret.refundedCents,
      items,
      createdAt: ret.createdAt.toISOString(),
      updatedAt: ret.updatedAt.toISOString(),
    };
  }

  async approve(storeId: string, id: string, adminNotes?: string | null) {
    await this.transitionStatus(storeId, id, "requested", "approved", adminNotes);
    await this.audit.log({
      storeId,
      action: "return.approved",
      targetType: "return",
      targetId: id,
    });
    return this.getReturn(storeId, id);
  }

  async reject(storeId: string, id: string, adminNotes?: string | null) {
    await this.transitionStatus(storeId, id, "requested", "rejected", adminNotes);
    await this.audit.log({
      storeId,
      action: "return.rejected",
      targetType: "return",
      targetId: id,
    });
    return this.getReturn(storeId, id);
  }

  async markReceived(storeId: string, id: string, adminNotes?: string | null) {
    await this.transitionStatus(storeId, id, "approved", "received", adminNotes);
    await this.audit.log({
      storeId,
      action: "return.received",
      targetType: "return",
      targetId: id,
    });

    // Once the items are physically received, issue the Stripe refund. The
    // ReturnRefundProcessor sets status → refunded and fires the customer email.
    // jobId dedupes so a double "mark received" can't refund twice.
    void this.returnsQueue.add(
      "return.process-refund",
      { returnId: id, storeId },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        jobId: `return.process-refund:${id}`,
      },
    );

    return this.getReturn(storeId, id);
  }

  async delete(storeId: string, id: string) {
    const ret = await this.db.query.returnsTable.findFirst({
      where: and(eq(returnsTable.id, id), eq(returnsTable.storeId, storeId)),
    });
    if (!ret) throw new NotFoundException("Return not found");
    await this.db.delete(returnsTable).where(eq(returnsTable.id, id));
    return { message: "Return deleted" };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async transitionStatus(
    storeId: string,
    id: string,
    from: string,
    to: string,
    adminNotes?: string | null,
  ) {
    const ret = await this.db.query.returnsTable.findFirst({
      where: and(eq(returnsTable.id, id), eq(returnsTable.storeId, storeId)),
    });
    if (!ret) throw new NotFoundException("Return not found");
    if (ret.status !== from) {
      throw new RpcException({ status: 400, message: `Return must be in '${from}' status` });
    }
    await this.db
      .update(returnsTable)
      .set({
        status: to as any,
        ...(adminNotes !== undefined && { adminNotes }),
        updatedAt: new Date(),
      })
      .where(eq(returnsTable.id, id));
  }

  private formatSettings(s: {
    returnWindowDays: number;
    autoApproveUnderCents: number | null;
    excludedProductIds: string[];
    returnReasons: unknown;
  }) {
    return {
      returnWindowDays: s.returnWindowDays,
      autoApproveUnderCents: s.autoApproveUnderCents,
      excludedProductIds: s.excludedProductIds,
      returnReasons: (s.returnReasons as { reason: string; subReasons: string[] }[]) ?? [],
    };
  }
}
