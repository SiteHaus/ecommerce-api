import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq, storesTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import Stripe from "stripe";

export interface BillingSetup {
  stripeCustomerId: string;
  hasDefaultPaymentMethod: boolean;
  setupUrl?: string;
}

export type ChargeResult =
  | { success: true; paymentIntentId: string }
  | { success: false; reason: string };

@Injectable()
export class PostageBillingService {
  private readonly logger = new Logger(PostageBillingService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    @Inject(DB_TOKEN) private readonly db: Db,
  ) {
    this.stripe = new Stripe(config.getOrThrow("STRIPE_SECRET_KEY"));
  }

  /**
   * Fetches the store's SiteHaus billing customer id from apps/api (get-or-
   * create) and caches it, the first time a store buys a label. Every call
   * after that reads the cache — this is the only place in the codebase that
   * ever calls the Task 3 endpoint.
   */
  private async resolveBillingCustomerId(
    storeId: string,
    clientId: string,
  ): Promise<string | null> {
    const apiUrl = this.config.getOrThrow("API_URL");
    const serviceKey = this.config.getOrThrow("COMMERCE_SERVICE_KEY");

    const response = await fetch(`${apiUrl}/clients/${clientId}/billing/stripe-customer`, {
      headers: { "x-service-key": serviceKey },
    });
    if (!response.ok) {
      this.logger.warn(`Billing-customer lookup failed for client ${clientId}: ${response.status}`);
      return null;
    }

    const { stripeCustomerId } = (await response.json()) as { stripeCustomerId: string | null };
    if (!stripeCustomerId) return null;

    await this.db
      .update(storesTable)
      .set({ stripeBillingCustomerId: stripeCustomerId })
      .where(eq(storesTable.id, storeId));
    return stripeCustomerId;
  }

  /**
   * Checks whether the store's reused SiteHaus billing customer has a default
   * payment method on file. If not, returns a Stripe Checkout setup-mode URL
   * so the merchant can add one — same hosted-page pattern Connect onboarding
   * already uses elsewhere in this codebase.
   */
  async getBillingSetup(storeId: string, returnUrl?: string): Promise<BillingSetup | null> {
    const store = await this.db.query.storesTable.findFirst({
      where: eq(storesTable.id, storeId),
      columns: { id: true, clientId: true, stripeBillingCustomerId: true },
    });
    if (!store) return null;

    const stripeCustomerId =
      store.stripeBillingCustomerId ??
      (await this.resolveBillingCustomerId(store.id, store.clientId));
    if (!stripeCustomerId) return null;

    const customer = await this.stripe.customers.retrieve(stripeCustomerId);
    const hasDefaultPaymentMethod =
      !("deleted" in customer) && !!customer.invoice_settings?.default_payment_method;

    if (hasDefaultPaymentMethod) {
      return { stripeCustomerId, hasDefaultPaymentMethod: true };
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: "setup",
      customer: stripeCustomerId,
      success_url: returnUrl ?? "https://sitehaus.dev",
      cancel_url: returnUrl ?? "https://sitehaus.dev",
    });

    return {
      stripeCustomerId,
      hasDefaultPaymentMethod: false,
      setupUrl: session.url ?? undefined,
    };
  }

  /**
   * Off-session charge for settlement. Never called speculatively — only from
   * the settlement job (Task 6) once a store's unsettled balance crosses $50
   * or it's month-end.
   */
  async charge(
    stripeCustomerId: string,
    amountCents: number,
    currency = "usd",
  ): Promise<ChargeResult> {
    try {
      const customer = await this.stripe.customers.retrieve(stripeCustomerId);
      const defaultPm =
        !("deleted" in customer) &&
        (customer.invoice_settings?.default_payment_method as string | null);
      if (!defaultPm) return { success: false, reason: "no default payment method" };

      const intent = await this.stripe.paymentIntents.create({
        amount: amountCents,
        currency,
        customer: stripeCustomerId,
        payment_method: defaultPm,
        off_session: true,
        confirm: true,
      });
      return { success: true, paymentIntentId: intent.id };
    } catch (err: any) {
      this.logger.warn(`Postage settlement charge failed for ${stripeCustomerId}: ${err.message}`);
      return { success: false, reason: err.message ?? "unknown error" };
    }
  }
}
