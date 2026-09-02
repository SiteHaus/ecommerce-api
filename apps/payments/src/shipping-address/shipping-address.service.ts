import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq, ordersTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import Stripe from "stripe";

export type ShippingStreet = { line1: string | null; line2: string | null };

@Injectable()
export class ShippingAddressService {
  private readonly logger = new Logger(ShippingAddressService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    @Inject(DB_TOKEN) private readonly db: Db,
  ) {
    this.stripe = new Stripe(config.getOrThrow("STRIPE_SECRET_KEY"));
  }

  /**
   * The street lives in Stripe, not in our database — but *where* in Stripe depends on who
   * collected it.
   *
   * Storefront collected it: we passed it as `payment_intent_data.shipping` when creating the
   * session, so it's on the PaymentIntent.
   * Stripe's hosted page collected it (`shipping_address_collection`, the default for
   * storefronts that redirect straight to Checkout): Stripe puts it on the Checkout Session
   * and never mirrors it onto the PaymentIntent. Ask the session too, or those orders show no
   * street at all.
   *
   * Returns nulls rather than throwing, always. An unavailable street must never fail an
   * order page or lose a receipt — the caller degrades instead. Legacy orders (placed before
   * we started sending `shipping` to Stripe) have it in neither place; they come back null
   * here and the caller falls back to the columns, which still hold their street until
   * redaction.
   */
  async getShippingStreet(orderId: string): Promise<ShippingStreet> {
    let order: { stripePaymentIntentId: string | null } | undefined;
    try {
      order = await this.db.query.ordersTable.findFirst({
        where: eq(ordersTable.id, orderId),
        columns: { stripePaymentIntentId: true },
      });
    } catch (err) {
      this.logger.warn(`DB lookup failed for order ${orderId}: ${this.errorMessage(err)}`);
      return { line1: null, line2: null };
    }
    const paymentIntentId = order?.stripePaymentIntentId;
    if (!paymentIntentId) return { line1: null, line2: null };

    try {
      const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      const fromIntent = this.readStreet(pi.shipping?.address);
      if (fromIntent.line1) return fromIntent;
    } catch (err) {
      this.logger.warn(
        `Stripe shipping lookup failed for order ${orderId}: ${this.errorMessage(err)}`,
      );
      return { line1: null, line2: null };
    }

    return this.streetFromCheckoutSession(paymentIntentId, orderId);
  }

  /**
   * No `stripe_checkout_session_id` column to retrieve by, so resolve the session from the
   * PaymentIntent. `collected_information.shipping_details` is where current API versions put
   * a hosted-page address; `shipping_details` is the same data under its older name, kept for
   * sessions created before the rename.
   */
  private async streetFromCheckoutSession(
    paymentIntentId: string,
    orderId: string,
  ): Promise<ShippingStreet> {
    try {
      const { data } = await this.stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
        limit: 1,
      });
      const session = data[0];
      return this.readStreet(
        session?.collected_information?.shipping_details?.address ??
          session?.shipping_details?.address,
      );
    } catch (err) {
      this.logger.warn(
        `Stripe checkout session lookup failed for order ${orderId}: ${this.errorMessage(err)}`,
      );
      return { line1: null, line2: null };
    }
  }

  private readStreet(address?: Stripe.Address | null): ShippingStreet {
    return { line1: address?.line1 ?? null, line2: address?.line2 ?? null };
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
