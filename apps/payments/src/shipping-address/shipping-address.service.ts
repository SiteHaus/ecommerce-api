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
 * them empty forever. Stripe copies the address collected on Checkout onto the PaymentIntent,
 * so the full thing is already in the response we fetch for the street — returning it costs
 * nothing extra and lets callers fall back to it.
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
   * The street lives on the PaymentIntent, not in our database.
   *
   * Returns nulls rather than throwing, always. An unavailable street must never fail an
   * order page or lose a receipt — the caller degrades instead. Legacy orders (placed before
   * we started sending `shipping` to Stripe) have no shipping on their PI; they come back
   * null here and the caller falls back to the columns, which still hold their street until
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
      const pi = await this.stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
      const address = pi.shipping?.address;
      return {
        line1: address?.line1 ?? null,
        line2: address?.line2 ?? null,
        name: pi.shipping?.name ?? null,
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
