import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { RpcException } from "@nestjs/microservices";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  orderItemsTable,
  ordersTable,
  sql,
  type Db,
} from "@sitehaus-ecom/database";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import type { Queue } from "bullmq";

@Injectable()
export class OrdersHandlerService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly audit: AuditService,
    @InjectQueue("ecom-notifications") private readonly notificationsQueue: Queue,
    @InjectQueue("ecom-webhooks") private readonly webhooksQueue: Queue,
  ) {}

  async getForCustomer(data: {
    storeId: string;
    orderId: string;
    userId?: string;
    email?: string;
  }) {
    const order = await this.db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, data.orderId),
    });

    if (!order || order.storeId !== data.storeId) {
      throw new NotFoundException("Order not found");
    }

    if (data.userId && order.userId) {
      // Authenticated user accessing their own order
      if (order.userId !== data.userId) throw new ForbiddenException("Access denied");
    } else if (data.userId && !order.userId && data.email) {
      // Authenticated user accessing an anonymous order — fall back to email check
      if (order.email.toLowerCase() !== data.email.toLowerCase()) {
        throw new ForbiddenException("Access denied");
      }
    } else if (!data.userId && data.email) {
      // Anonymous lookup by email
      if (order.email.toLowerCase() !== data.email.toLowerCase()) {
        throw new ForbiddenException("Access denied");
      }
    } else {
      throw new ForbiddenException("Access denied");
    }

    const items = await this.db
      .select({
        productName: orderItemsTable.productName,
        variantName: orderItemsTable.variantName,
        sku: orderItemsTable.sku,
        quantity: orderItemsTable.quantity,
        unitPriceCents: orderItemsTable.unitPriceCents,
        totalCents: orderItemsTable.totalCents,
      })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.id));

    return {
      id: order.id,
      status: order.status,
      email: order.email,
      createdAt: order.createdAt.toISOString(),
      confirmedAt: order.confirmedAt?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      trackingNumber: order.trackingNumber ?? null,
      shipping: {
        name: order.shippingName ?? "",
        line1: order.shippingLine1 ?? "",
        line2: order.shippingLine2 ?? null,
        city: order.shippingCity ?? "",
        state: order.shippingState ?? null,
        zip: order.shippingZip ?? "",
        country: order.shippingCountry ?? "",
      },
      items: items.map((i) => ({
        productName: i.productName,
        variantName: i.variantName,
        sku: i.sku ?? null,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        totalCents: i.totalCents,
      })),
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      totalCents: order.totalCents,
      currency: order.currency,
    };
  }

  async adminGet(data: { storeId: string; orderId: string }) {
    const order = await this.db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, data.orderId),
    });

    if (!order || order.storeId !== data.storeId) {
      throw new NotFoundException("Order not found");
    }

    const [{ itemCount }] = await this.db
      .select({ itemCount: sql<number>`cast(count(*) as int)` })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.id));

    const items = await this.db
      .select({
        productName: orderItemsTable.productName,
        variantName: orderItemsTable.variantName,
        sku: orderItemsTable.sku,
        quantity: orderItemsTable.quantity,
        unitPriceCents: orderItemsTable.unitPriceCents,
        totalCents: orderItemsTable.totalCents,
      })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.id));

    return {
      id: order.id,
      status: order.status,
      email: order.email,
      itemCount,
      subtotalCents: order.subtotalCents,
      totalCents: order.totalCents,
      currency: order.currency,
      shippingCountry: order.shippingCountry ?? null,
      trackingNumber: order.trackingNumber ?? null,
      createdAt: order.createdAt.toISOString(),
      confirmedAt: order.confirmedAt?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      shippingName: order.shippingName ?? null,
      shippingLine1: order.shippingLine1 ?? null,
      shippingLine2: order.shippingLine2 ?? null,
      shippingCity: order.shippingCity ?? null,
      shippingState: order.shippingState ?? null,
      shippingZip: order.shippingZip ?? null,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      notes: order.notes ?? null,
      stripePaymentIntentId: order.stripePaymentIntentId ?? null,
      items: items.map((i) => ({
        productName: i.productName,
        variantName: i.variantName,
        sku: i.sku ?? null,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        totalCents: i.totalCents,
      })),
    };
  }

  async adminList(data: {
    storeId: string;
    status?: string[];
    email?: string;
    limit: number;
    offset: number;
    sort: "newest" | "oldest";
  }) {
    const conditions = [eq(ordersTable.storeId, data.storeId)];
    if (data.status?.length) conditions.push(inArray(ordersTable.status, data.status as any));
    if (data.email) conditions.push(ilike(ordersTable.email, `%${data.email}%`));
    const where = and(...conditions);

    const orderBy =
      data.sort === "oldest" ? asc(ordersTable.createdAt) : desc(ordersTable.createdAt);

    const itemCountSq = this.db
      .select({
        orderId: orderItemsTable.orderId,
        itemCount: sql<number>`cast(count(*) as int)`.as("item_count"),
      })
      .from(orderItemsTable)
      .groupBy(orderItemsTable.orderId)
      .as("item_counts");

    const [{ count }] = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(ordersTable)
      .where(where);

    const rows = await this.db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        email: ordersTable.email,
        itemCount: sql<number>`coalesce(${itemCountSq.itemCount}, 0)`,
        subtotalCents: ordersTable.subtotalCents,
        totalCents: ordersTable.totalCents,
        currency: ordersTable.currency,
        shippingCountry: ordersTable.shippingCountry,
        trackingNumber: ordersTable.trackingNumber,
        createdAt: ordersTable.createdAt,
        confirmedAt: ordersTable.confirmedAt,
        shippedAt: ordersTable.shippedAt,
      })
      .from(ordersTable)
      .leftJoin(itemCountSq, eq(ordersTable.id, itemCountSq.orderId))
      .where(where)
      .orderBy(orderBy)
      .limit(data.limit)
      .offset(data.offset);

    return {
      items: rows.map((o) => ({
        id: o.id,
        status: o.status,
        email: o.email,
        itemCount: o.itemCount,
        subtotalCents: o.subtotalCents,
        totalCents: o.totalCents,
        currency: o.currency,
        shippingCountry: o.shippingCountry ?? null,
        trackingNumber: o.trackingNumber ?? null,
        createdAt: o.createdAt.toISOString(),
        confirmedAt: o.confirmedAt?.toISOString() ?? null,
        shippedAt: o.shippedAt?.toISOString() ?? null,
      })),
      total: Number(count),
    };
  }

  async ship(data: { storeId: string; orderId: string; trackingNumber: string }) {
    const order = await this.db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, data.orderId),
    });

    if (!order || order.storeId !== data.storeId) {
      throw new RpcException({ status: 404, message: "Order not found" });
    }

    const now = new Date();
    const updated = await this.db
      .update(ordersTable)
      .set({
        status: "shipped",
        trackingNumber: data.trackingNumber,
        shippedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(ordersTable.id, data.orderId),
          eq(ordersTable.storeId, data.storeId),
          eq(ordersTable.status, "confirmed"),
        ),
      )
      .returning({ id: ordersTable.id });

    if (updated.length === 0) {
      throw new RpcException({ status: 400, message: "Only confirmed orders can be shipped" });
    }

    void this.notificationsQueue.add(
      "order.shipped",
      { orderId: data.orderId, storeId: data.storeId },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
    void this.webhooksQueue.add("webhook.dispatch", {
      storeId: data.storeId,
      event: "order.shipped",
      data: { orderId: data.orderId, trackingNumber: data.trackingNumber },
    });

    void this.audit.log({
      storeId: data.storeId,
      action: "order.shipped",
      targetType: "order",
      targetId: data.orderId,
    });

    return this.adminGet({ storeId: data.storeId, orderId: data.orderId });
  }

  async listForCustomer(data: { storeId: string; userId: string; limit: number; offset: number }) {
    const where = and(eq(ordersTable.storeId, data.storeId), eq(ordersTable.userId, data.userId));

    const [{ count }] = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(ordersTable)
      .where(where);

    const orders = await this.db
      .select()
      .from(ordersTable)
      .where(where)
      .orderBy(desc(ordersTable.createdAt))
      .limit(data.limit)
      .offset(data.offset);

    const items = orders.map((o) => ({
      id: o.id,
      status: o.status,
      email: o.email,
      createdAt: o.createdAt.toISOString(),
      confirmedAt: o.confirmedAt?.toISOString() ?? null,
      shippedAt: o.shippedAt?.toISOString() ?? null,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
      trackingNumber: o.trackingNumber ?? null,
      subtotalCents: o.subtotalCents,
      shippingCents: o.shippingCents,
      taxCents: o.taxCents,
      totalCents: o.totalCents,
      currency: o.currency,
    }));

    return { items, total: Number(count) };
  }
}
