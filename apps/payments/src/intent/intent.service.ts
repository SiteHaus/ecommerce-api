import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import { eq, orderItemsTable, ordersTable, storesTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import Stripe from "stripe";

@Injectable()
export class IntentService {
  private readonly logger = new Logger(IntentService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    @Inject(DB_TOKEN) private readonly db: Db,
  ) {
    this.stripe = new Stripe(config.getOrThrow("STRIPE_SECRET_KEY"));
  }

  async createIntent(
    orderId: string,
    successUrl: string,
    cancelUrl: string,
    cartId?: string,
  ): Promise<{ checkoutUrl: string }> {
    const order = await this.db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, orderId),
    });

    if (!order) {
      throw new RpcException({ status: 404, message: "Order not found" });
    }

    const store = await this.db.query.storesTable.findFirst({
      where: eq(storesTable.id, order.storeId),
      columns: {
        stripeAccountId: true,
        stripeChargesEnabled: true,
        currency: true,
      },
    });

    if (!store?.stripeAccountId || !store.stripeChargesEnabled) {
      throw new RpcException({
        status: 400,
        message: "Store payment processing is not configured",
      });
    }

    const items = await this.db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, orderId));

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: order.email,
        line_items: items.map((item) => ({
          price_data: {
            currency: order.currency,
            unit_amount: item.unitPriceCents,
            product_data: {
              name: `${item.productName} — ${item.variantName}`,
              ...(item.sku ? { metadata: { sku: item.sku } } : {}),
            },
          },
          quantity: item.quantity,
        })),
        payment_intent_data: {
          transfer_data: { destination: store.stripeAccountId },
          metadata: { orderId: order.id, storeId: order.storeId },
        },
        metadata: { orderId: order.id, storeId: order.storeId, ...(cartId ? { cartId } : {}) },
        automatic_tax: { enabled: true },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
    } catch (err: any) {
      this.logger.error(
        `Stripe checkout session creation failed for order ${orderId}: ${err.message}`,
      );
      throw new RpcException({ status: 500, message: "Stripe error" });
    }

    await this.db
      .update(ordersTable)
      .set({ stripePaymentIntentId: session.id, updatedAt: new Date() })
      .where(eq(ordersTable.id, orderId));

    return { checkoutUrl: session.url! };
  }
}
