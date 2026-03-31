import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { eq, orderItemsTable, ordersTable, storesTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN, EmailService } from "@sitehaus-ecom/shared";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

@Injectable()
@Processor("ecom-notifications")
export class OrderConfirmedProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderConfirmedProcessor.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly email: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "order.confirmed") return;

    const { orderId, storeId } = job.data as { orderId: string; storeId: string };

    const order = await this.db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, orderId),
    });

    if (!order || order.storeId !== storeId) {
      this.logger.error(`Order ${orderId} not found for store ${storeId}`);
      return;
    }

    const [items, store] = await Promise.all([
      this.db
        .select({
          productName: orderItemsTable.productName,
          variantName: orderItemsTable.variantName,
          quantity: orderItemsTable.quantity,
          unitPriceCents: orderItemsTable.unitPriceCents,
          totalCents: orderItemsTable.totalCents,
        })
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, orderId)),
      this.db.query.storesTable.findFirst({
        where: eq(storesTable.id, storeId),
        columns: { name: true },
      }),
    ]);

    const storeName = escapeHtml(store?.name ?? "Your Store");
    const ref = orderId.slice(0, 8).toUpperCase();
    const cur = order.currency;

    const itemRows = items
      .map(
        (i) =>
          `<tr>
            <td style="padding:6px 0">${i.productName} — ${i.variantName}</td>
            <td style="padding:6px 0;text-align:right">x${i.quantity}</td>
            <td style="padding:6px 0;text-align:right">${formatCents(i.totalCents, cur)}</td>
          </tr>`,
      )
      .join("");

    const address = [
      order.shippingName,
      order.shippingLine1,
      order.shippingLine2,
      `${order.shippingCity ?? ""}${order.shippingState ? ", " + order.shippingState : ""} ${order.shippingZip ?? ""}`.trim(),
      order.shippingCountry,
    ]
      .filter(Boolean)
      .join("<br>");

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
        <h2 style="margin-bottom:4px">${storeName}</h2>
        <h3 style="color:#444;font-weight:normal">Order confirmed — #${ref}</h3>
        <p>Thanks for your order! We'll let you know when it ships.</p>

        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          <thead>
            <tr style="border-bottom:2px solid #eee">
              <th style="text-align:left;padding:6px 0">Item</th>
              <th style="text-align:right;padding:6px 0">Qty</th>
              <th style="text-align:right;padding:6px 0">Price</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot style="border-top:2px solid #eee">
            <tr>
              <td colspan="2" style="padding:6px 0">Subtotal</td>
              <td style="text-align:right">${formatCents(order.subtotalCents, cur)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:6px 0">Shipping</td>
              <td style="text-align:right">${formatCents(order.shippingCents, cur)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:6px 0">Tax</td>
              <td style="text-align:right">${formatCents(order.taxCents, cur)}</td>
            </tr>
            <tr style="font-weight:bold">
              <td colspan="2" style="padding:6px 0">Total</td>
              <td style="text-align:right">${formatCents(order.totalCents, cur)}</td>
            </tr>
          </tfoot>
        </table>

        <h4 style="margin-bottom:4px">Shipping to</h4>
        <p style="line-height:1.6;margin:0">${address}</p>
      </div>
    `;

    await this.email.send({
      to: order.email,
      subject: `Order confirmed — #${ref}`,
      html,
    });

    this.logger.log(`Order confirmation email sent for order ${orderId}`);
  }
}
