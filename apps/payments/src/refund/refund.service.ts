import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import { eq, orderItemsTable, ordersTable, sql, type Db } from "@sitehaus-ecom/database";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import Stripe from "stripe";

@Injectable()
export class RefundService {
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly audit: AuditService,
  ) {
    this.stripe = new Stripe(config.getOrThrow("STRIPE_SECRET_KEY"));
  }

  async refund(data: { storeId: string; orderId: string; store: { stripeAccountId: string } }) {
    const order = await this.db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, data.orderId),
    });

    if (!order || order.storeId !== data.storeId) {
      throw new RpcException({ status: 404, message: "Order not found" });
    }

    if (order.status !== "confirmed" && order.status !== "shipped") {
      throw new RpcException({
        status: 400,
        message: "Only confirmed or shipped orders can be refunded",
      });
    }

    if (!order.stripePaymentIntentId) {
      throw new RpcException({ status: 400, message: "Order has no associated payment" });
    }

    try {
      await this.stripe.refunds.create(
        { payment_intent: order.stripePaymentIntentId },
        { stripeAccount: data.store.stripeAccountId },
      );
    } catch (err: any) {
      throw new RpcException({
        status: 502,
        message: err.message ?? "Stripe refund failed",
      });
    }

    const now = new Date();
    await this.db
      .update(ordersTable)
      .set({ status: "refunded", updatedAt: now })
      .where(eq(ordersTable.id, data.orderId));

    void this.audit.log({
      storeId: data.storeId,
      action: "order.refunded",
      targetType: "order",
      targetId: data.orderId,
      meta: { stripePaymentIntentId: order.stripePaymentIntentId },
    });

    const [{ itemCount }] = await this.db
      .select({ itemCount: sql<number>`cast(count(*) as int)` })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, data.orderId));

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
      .where(eq(orderItemsTable.orderId, data.orderId));

    return {
      id: order.id,
      status: "refunded" as const,
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
}
