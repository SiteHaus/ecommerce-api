import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { eq, ordersTable, storesTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN, EmailService } from "@sitehaus-ecom/shared";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

@Injectable()
@Processor("ecom-notifications")
export class OrderShippedProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderShippedProcessor.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly email: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "order.shipped") return;

    const { orderId, storeId } = job.data as { orderId: string; storeId: string };

    const order = await this.db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, orderId),
    });

    if (!order || order.storeId !== storeId) {
      this.logger.error(`Order ${orderId} not found for store ${storeId}`);
      return;
    }

    const store = await this.db.query.storesTable.findFirst({
      where: eq(storesTable.id, storeId),
      columns: { name: true },
    });

    const storeName = escapeHtml(store?.name ?? "Your Store");
    const ref = orderId.slice(0, 8).toUpperCase();

    const address = [
      order.shippingName,
      order.shippingLine1,
      order.shippingLine2,
      `${order.shippingCity ?? ""}${order.shippingState ? ", " + order.shippingState : ""} ${order.shippingZip ?? ""}`.trim(),
      order.shippingCountry,
    ]
      .filter(Boolean)
      .join("<br>");

    const trackingSection = order.trackingNumber
      ? `<p><strong>Tracking number:</strong> ${order.trackingNumber}</p>`
      : "";

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
        <h2 style="margin-bottom:4px">${storeName}</h2>
        <h3 style="color:#444;font-weight:normal">Your order has shipped! — #${ref}</h3>
        <p>Great news — your order is on its way.</p>
        ${trackingSection}
        <h4 style="margin-bottom:4px">Shipping to</h4>
        <p style="line-height:1.6;margin:0">${address}</p>
      </div>
    `;

    await this.email.send({
      to: order.email,
      subject: "Your order has shipped!",
      html,
    });

    this.logger.log(`Order shipped email sent for order ${orderId}`);
  }
}
