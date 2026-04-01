import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { cartsTable, eq, ordersTable, storesTable, type Db } from "@sitehaus-ecom/database";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import { Queue } from "bullmq";
import Stripe from "stripe";
import { ReservationService } from "./reservation.service";

@Injectable()
export class WebhookService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly reservations: ReservationService,
    private readonly audit: AuditService,
    @InjectQueue("ecom-notifications") private readonly notificationsQueue: Queue,
  ) {
    this.stripe = new Stripe(config.getOrThrow("STRIPE_SECRET_KEY"));
    this.webhookSecret = config.getOrThrow("STRIPE_WEBHOOK_SECRET");
  }

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event | null {
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (err: any) {
      this.logger.warn(`Invalid Stripe webhook signature: ${err.message}`);
      return null;
    }
  }

  async handle(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
        await this.handleSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case "account.updated":
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handleSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) {
      this.logger.warn("checkout.session.completed received without orderId metadata");
      return;
    }

    const order = await this.db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, orderId),
    });

    if (!order) {
      this.logger.warn(`checkout.session.completed: order ${orderId} not found`);
      return;
    }

    // Idempotency — already confirmed
    if (order.status === "confirmed") return;

    await this.reservations.commit(orderId);

    const taxCents = session.total_details?.amount_tax ?? 0;
    await this.db
      .update(ordersTable)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        updatedAt: new Date(),
        taxCents,
        totalCents: order.subtotalCents + order.shippingCents + taxCents,
      })
      .where(eq(ordersTable.id, orderId));

    const cartId = session.metadata?.cartId;
    if (cartId) {
      await this.db.delete(cartsTable).where(eq(cartsTable.id, cartId));
    }

    await this.audit.log({
      storeId: order.storeId,
      userId: order.userId ?? undefined,
      action: "order.confirmed",
      targetType: "order",
      targetId: order.id,
    });

    void this.notificationsQueue.add(
      "order.confirmed",
      { orderId, storeId: order.storeId },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
    this.logger.log(`Order ${orderId} confirmed`);
  }

  private async handleSessionExpired(session: Stripe.Checkout.Session): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;

    const order = await this.db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, orderId),
    });

    if (!order || order.status !== "pending") return;

    await this.reservations.releaseByOrder(orderId);

    await this.db
      .update(ordersTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(ordersTable.id, orderId));

    await this.audit.log({
      storeId: order.storeId,
      userId: order.userId ?? undefined,
      action: "order.failed",
      targetType: "order",
      targetId: order.id,
    });

    this.logger.log(`Order ${orderId} failed — session expired`);
  }

  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    const result = await this.db
      .update(storesTable)
      .set({
        stripeChargesEnabled: account.charges_enabled ?? false,
        stripePayoutsEnabled: account.payouts_enabled ?? false,
        stripeDetailsSubmitted: account.details_submitted ?? false,
        updatedAt: new Date(),
      })
      .where(eq(storesTable.stripeAccountId, account.id))
      .returning({ id: storesTable.id });

    if (result.length === 0) {
      this.logger.debug(`account.updated: no store found for Stripe account ${account.id}`);
      return;
    }

    await this.audit.log({
      storeId: result[0].id,
      action: "store.stripe_account_updated",
      targetType: "store",
      targetId: result[0].id,
      meta: {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
      },
    });
  }
}
