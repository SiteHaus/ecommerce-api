import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { eq, orderItemsTable, ordersTable, storesTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN, EmailService } from "@sitehaus-ecom/shared";
import { render } from "@react-email/render";
import { OrderConfirmedEmail } from "@sitehaus-ecom/email-templates/emails/order-confirmed";
import { OrderShippedEmail } from "@sitehaus-ecom/email-templates/emails/order-shipped";

@Injectable()
@Processor("ecom-notifications")
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly email: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case "order.confirmed":
        return this.handleOrderConfirmed(job);
      case "order.shipped":
        return this.handleOrderShipped(job);
      default:
        this.logger.warn(`Unhandled notification job: ${job.name}`);
    }
  }

  private async handleOrderConfirmed(job: Job): Promise<void> {
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
        columns: { name: true, notificationEmail: true },
      }),
    ]);

    const ref = orderId.slice(0, 8).toUpperCase();

    const html = await render(
      OrderConfirmedEmail({
        storeName: store?.name ?? "Your Store",
        name: order.userId,
        orderNumber: ref,
        items: items,
        orderDate: new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(order.createdAt),
        products: items.map((i) => `${i.productName} — ${i.variantName} × ${i.quantity}`),
        subtotal: order.subtotalCents / 100,
        shipping: order.shippingCents / 100,
        tax: order.taxCents / 100,
        total: order.totalCents / 100,
        deliveryAddress: order.shippingLine1,
      }),
    );

    const recipients: string[] = [order.email];
    if (store?.notificationEmail) recipients.push(store.notificationEmail);

    await this.email.send({
      to: recipients,
      from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
      subject: `Order confirmed — #${ref}`,
      html,
    });

    this.logger.log(
      `Order confirmation email sent for order ${orderId} to ${recipients.join(", ")}`,
    );
  }

  private async handleOrderShipped(job: Job): Promise<void> {
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

    const ref = orderId.slice(0, 8).toUpperCase();

    const html = await render(
      OrderShippedEmail({
        storeName: store?.name ?? "Your Store",
        name: order.userId,
        orderNumber: ref,
        trackingNumber: order.trackingNumber ?? undefined,
      }),
    );

    await this.email.send({
      to: order.email,
      from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
      subject: `Your order has shipped! — #${ref}`,
      html,
    });

    this.logger.log(`Order shipped email sent for order ${orderId}`);
  }
}
