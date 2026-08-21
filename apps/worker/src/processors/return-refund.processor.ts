import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue } from "bullmq";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { Db, eq, ordersTable, returnItemsTable, returnsTable } from "@sitehaus-ecom/database";
import Stripe from "stripe";

@Processor("ecom-returns")
export class ReturnRefundProcessor extends WorkerHost {
  private readonly logger = new Logger(ReturnRefundProcessor.name);
  private readonly stripe: Stripe;

  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly config: ConfigService,
    @InjectQueue("ecom-notifications") private readonly notificationsQueue: Queue,
  ) {
    super();
    this.stripe = new Stripe(config.getOrThrow("STRIPE_SECRET_KEY"));
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "return.process-refund") return;
    const { returnId, storeId } = job.data as { returnId: string; storeId: string };
    await this.processRefund(returnId, storeId);
  }

  private async processRefund(returnId: string, storeId: string): Promise<void> {
    const ret = await this.db.query.returnsTable.findFirst({
      where: eq(returnsTable.id, returnId),
    });

    if (!ret || ret.status !== "received") {
      this.logger.warn(`Return ${returnId} not in received status — skipping refund`);
      return;
    }

    const order = await this.db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, ret.orderId),
      columns: { stripePaymentIntentId: true },
    });

    if (!order?.stripePaymentIntentId) {
      this.logger.error(`Order ${ret.orderId} has no Stripe payment intent — cannot refund`);
      return;
    }

    const items = await this.db
      .select()
      .from(returnItemsTable)
      .where(eq(returnItemsTable.returnId, returnId));

    const totalRefundCents = items.reduce((sum, i) => sum + i.refundCents, 0);

    // Checkout uses a destination charge, so the PaymentIntent lives on the
    // PLATFORM account — the refund must be issued there (no stripeAccount
    // header), with reverse_transfer to pull the funds back from the store's
    // balance. Passing the connected account made Stripe fail with
    // "No such payment_intent" (same bug fixed for order refunds).
    const refund = await this.stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      amount: totalRefundCents,
      reverse_transfer: true,
    });

    await this.db
      .update(returnsTable)
      .set({
        status: "refunded",
        refundedCents: totalRefundCents,
        stripeRefundId: refund.id,
        updatedAt: new Date(),
      })
      .where(eq(returnsTable.id, returnId));

    this.logger.log(
      `Refund ${refund.id} issued for return ${returnId} — ${totalRefundCents} cents`,
    );

    void this.notificationsQueue
      .add(
        "order.return_refunded",
        { orderId: ret.orderId, storeId },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          jobId: `order.return_refunded-${returnId}`,
        },
      )
      .catch((err: unknown) =>
        this.logger.warn(
          `Failed to enqueue order.return_refunded notification for ${returnId}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  }
}
