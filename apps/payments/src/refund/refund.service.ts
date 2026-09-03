import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import {
  and,
  eq,
  inArray,
  orderItemsTable,
  ordersTable,
  sql,
  type Db,
} from "@sitehaus-ecom/database";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import { Queue } from "bullmq";
import Stripe from "stripe";

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly audit: AuditService,
    @InjectQueue("ecom-notifications") private readonly notificationsQueue: Queue,
    @InjectQueue("ecom-webhooks") private readonly webhooksQueue: Queue,
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
      // Checkout uses a destination charge (payment_intent_data.transfer_data),
      // so the PaymentIntent lives on the PLATFORM account, not the connected
      // account. The refund must therefore be issued on the platform account
      // (no stripeAccount header) — passing the connected account here makes
      // Stripe look for the PI where it doesn't exist ("No such payment_intent").
      // reverse_transfer pulls the transferred funds back from the store's
      // balance so the platform doesn't eat the refund.
      await this.stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
        reverse_transfer: true,
      });
    } catch (err: any) {
      this.logger.error(`Stripe refund failed for order ${data.orderId}: ${err.message}`);
      throw new RpcException({ status: 502, message: "Stripe refund failed" });
    }

    const now = new Date();
    const [updated] = await this.db
      .update(ordersTable)
      .set({ status: "refunded", updatedAt: now })
      .where(
        and(
          eq(ordersTable.id, data.orderId),
          eq(ordersTable.storeId, data.storeId),
          inArray(ordersTable.status, ["confirmed", "shipped"]),
        ),
      )
      .returning({ id: ordersTable.id });

    if (!updated) {
      this.logger.error(
        `Refund succeeded on Stripe but order ${data.orderId} status not updated — manual review needed`,
      );
    }

    void this.audit.log({
      storeId: data.storeId,
      action: "order.refunded",
      targetType: "order",
      targetId: data.orderId,
      meta: { stripePaymentIntentId: order.stripePaymentIntentId },
    });
    void this.notificationsQueue
      .add(
        "order.refunded",
        { orderId: data.orderId, storeId: data.storeId },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          jobId: `order.refunded-${data.orderId}`,
        },
      )
      .catch((err: unknown) =>
        this.logger.warn(
          `Failed to enqueue order.refunded notification for ${data.orderId}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    // Merchant-facing notification — own job, own dedupe, same reasoning as
    // order.placed alongside order.confirmed.
    void this.notificationsQueue
      .add(
        "refund.placed",
        { orderId: data.orderId, storeId: data.storeId },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          jobId: `refund.placed-${data.orderId}`,
        },
      )
      .catch((err: unknown) =>
        this.logger.warn(
          `Failed to enqueue refund.placed notification for ${data.orderId}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    void this.webhooksQueue
      .add("webhook.dispatch", {
        storeId: data.storeId,
        event: "order.refunded",
        data: { orderId: data.orderId },
      })
      .catch((err: unknown) =>
        this.logger.warn(
          `Failed to enqueue order.refunded webhook dispatch for ${data.orderId}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );

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
