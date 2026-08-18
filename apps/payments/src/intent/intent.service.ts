import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import {
  and,
  customersTable,
  eq,
  orderItemsTable,
  ordersTable,
  shippingRatesTable,
  storesTable,
  type Db,
} from "@sitehaus-ecom/database";
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
    stripeCouponId?: string | null,
    shipping?: {
      name?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    },
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

    if (!store?.stripeAccountId) {
      throw new RpcException({
        status: 400,
        message: "Store payment processing is not configured",
      });
    }

    // If charges aren't yet enabled per DB, sync live from Stripe in case webhook hasn't fired
    let chargesEnabled = store.stripeChargesEnabled;
    if (!chargesEnabled) {
      try {
        const account = await this.stripe.accounts.retrieve(store.stripeAccountId);
        chargesEnabled = account.charges_enabled ?? false;
        if (chargesEnabled) {
          await this.db
            .update(storesTable)
            .set({
              stripeChargesEnabled: account.charges_enabled ?? false,
              stripePayoutsEnabled: account.payouts_enabled ?? false,
              stripeDetailsSubmitted: account.details_submitted ?? false,
              updatedAt: new Date(),
            })
            .where(eq(storesTable.id, order.storeId));
        }
      } catch (err: any) {
        this.logger.warn(
          `Live Stripe account sync failed for store ${order.storeId}: ${err.message}`,
        );
      }
    }

    if (!chargesEnabled) {
      throw new RpcException({
        status: 400,
        message: "Store payment processing is not configured",
      });
    }

    const items = await this.db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, orderId));

    let shippingOption: Stripe.Checkout.SessionCreateParams.ShippingOption | undefined;
    if (order.shippingRateId) {
      const [rate] = await this.db
        .select({
          name: shippingRatesTable.name,
          estimatedDays: shippingRatesTable.estimatedDays,
        })
        .from(shippingRatesTable)
        .where(eq(shippingRatesTable.id, order.shippingRateId));

      if (rate) {
        shippingOption = {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: order.shippingCents, currency: order.currency },
            display_name: rate.name,
            ...(rate.estimatedDays
              ? {
                  delivery_estimate: {
                    maximum: { unit: "business_day", value: rate.estimatedDays },
                  },
                }
              : {}),
          },
        };
      }
    }

    // Look up Stripe Customer for pre-fill if this is an authenticated user
    let stripeCustomerParam: { customer: string } | { customer_email?: string } = order.email
      ? { customer_email: order.email }
      : {};
    if (order.userId) {
      const customerRecord = await this.db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.storeId, order.storeId),
          eq(customersTable.userId, order.userId),
        ),
        columns: { stripeCustomerId: true },
      });
      if (customerRecord?.stripeCustomerId) {
        stripeCustomerParam = { customer: customerRecord.stripeCustomerId };
      }
    }

    // Automatic discount takes precedence; if none, allow customer to enter a promo code
    const discountParams: Pick<
      Stripe.Checkout.SessionCreateParams,
      "discounts" | "allow_promotion_codes"
    > = stripeCouponId
      ? { discounts: [{ coupon: stripeCouponId }] }
      : { allow_promotion_codes: true };

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.create({
        mode: "payment",
        ...stripeCustomerParam,
        // Storefronts don't collect a shipping address of their own (checkout is a
        // straight redirect to this session) — without this, Stripe never asks for
        // one either, and the order is left with no shipping address anywhere, ever.
        // US-only for now; no store has configured shipping zones outside it yet.
        shipping_address_collection: { allowed_countries: ["US"] },
        ...(shippingOption ? { shipping_options: [shippingOption] } : {}),
        ...discountParams,
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
          // Stripe is the system of record for the street — it is deliberately never written
          // to our DB (see the address-minimization spec). Stripe requires BOTH name and
          // line1: a partial address is a 400, so send all of it or none of it.
          ...(shipping?.name && shipping.line1
            ? {
                shipping: {
                  name: shipping.name,
                  address: {
                    line1: shipping.line1,
                    ...(shipping.line2 ? { line2: shipping.line2 } : {}),
                    ...(shipping.city ? { city: shipping.city } : {}),
                    ...(shipping.state ? { state: shipping.state } : {}),
                    ...(shipping.zip ? { postal_code: shipping.zip } : {}),
                    ...(shipping.country ? { country: shipping.country } : {}),
                  },
                },
              }
            : {}),
        },
        metadata: { orderId: order.id, storeId: order.storeId, ...(cartId ? { cartId } : {}) },
        automatic_tax: { enabled: true },
        success_url: `${successUrl}?orderId=${orderId}`,
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
      .set({ stripePaymentIntentId: session.payment_intent as string, updatedAt: new Date() })
      .where(eq(ordersTable.id, orderId));

    return { checkoutUrl: session.url! };
  }
}
