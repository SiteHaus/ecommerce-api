import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq, ordersTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import Stripe from "stripe";

export type ShippingStreet = { line1: string | null; line2: string | null };

/**
 * Everything Stripe holds for an order's shipping address, not just the street.
 *
 * The street is the only part that is *exclusively* here — name/city/state/zip/country are
 * supposed to live in our columns too. But when a storefront doesn't collect the address
 * itself (Stripe's hosted page is the only place it is ever entered), those columns are only
 * ever filled by the confirmation webhook, so any order that missed that reconciliation has
 * them empty forever. The full address (including the street) lives on the Checkout Session's
 * shipping_details, not on the PaymentIntent — Stripe never copies it there on its own, so
 * fetching it here costs an extra list call, but returning the whole thing lets callers fall
 * back to it.
 */
export type StripeShippingAddress = ShippingStreet & {
  name: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
};

const EMPTY: StripeShippingAddress = {
  line1: null,
  line2: null,
  name: null,
  city: null,
  state: null,
  zip: null,
  country: null,
};

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
   * The street lives on the Checkout Session that collected it, not on the
   * PaymentIntent it paid — Stripe's own docs are explicit that
   * shipping_address_collection saves the address onto the Session's
   * shipping_details, never automatically onto the PaymentIntent. We only
   * store the PaymentIntent id on the order, so look the Session up by it
   * (Stripe's List Checkout Sessions supports filtering by payment_intent).
   *
   * Two possible shapes depending on Stripe API version — same
   * collected_information.shipping_details vs shipping_details fallback
   * webhook.service.ts already handles for the "basil+" payload.
   *
   * Returns nulls rather than throwing, always. An unavailable street must never fail an
   * order page or lose a receipt — the caller degrades instead. Orders whose Checkout Session
   * never collected shipping (no session found, or the field genuinely empty) come back null
   * here and the caller falls back to the columns, which still hold their street until
   * redaction.
   */
  async getShippingAddress(orderId: string): Promise<StripeShippingAddress> {
    let order: { stripePaymentIntentId: string | null } | undefined;
    try {
      order = await this.db.query.ordersTable.findFirst({
        where: eq(ordersTable.id, orderId),
        columns: { stripePaymentIntentId: true },
      });
    } catch (err) {
      this.logger.warn(`DB lookup failed for order ${orderId}: ${this.errorMessage(err)}`);
      return EMPTY;
    }
    if (!order?.stripePaymentIntentId) return EMPTY;

    try {
      const sessions = await this.stripe.checkout.sessions.list({
        payment_intent: order.stripePaymentIntentId,
        limit: 1,
      });
      const session = sessions.data[0];
      const shipping =
        session?.collected_information?.shipping_details ?? session?.shipping_details ?? null;
      const address = shipping?.address;
      return {
        line1: address?.line1 ?? null,
        line2: address?.line2 ?? null,
        name: shipping?.name ?? null,
        city: address?.city ?? null,
        state: address?.state ?? null,
        zip: address?.postal_code ?? null,
        country: address?.country ?? null,
      };
    } catch (err) {
      this.logger.warn(
        `Stripe shipping lookup failed for order ${orderId}: ${this.errorMessage(err)}`,
      );
      return EMPTY;
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
