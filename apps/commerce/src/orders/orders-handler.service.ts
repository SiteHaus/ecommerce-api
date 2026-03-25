import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, orderItemsTable, ordersTable, sql, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";

@Injectable()
export class OrdersHandlerService {
  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

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
