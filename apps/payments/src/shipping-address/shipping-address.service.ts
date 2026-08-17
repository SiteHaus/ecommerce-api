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
   * The street lives on the PaymentIntent, not in our database.
   *
   * Returns nulls rather than throwing, always. An unavailable street must never fail an
   * order page or lose a receipt — the caller degrades instead. Legacy orders (placed before
   * we started sending `shipping` to Stripe) have no shipping on their PI; they come back
   * null here and the caller falls back to the columns, which still hold their street until
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
    if (!order?.stripePaymentIntentId) return { line1: null, line2: null };

    try {
      const pi = await this.stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
      return {
        line1: pi.shipping?.address?.line1 ?? null,
        line2: pi.shipping?.address?.line2 ?? null,
      };
    } catch (err) {
      this.logger.warn(
        `Stripe shipping lookup failed for order ${orderId}: ${this.errorMessage(err)}`,
      );
      return { line1: null, line2: null };
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
