import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { eq, orderItemsTable, ordersTable, storesTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN, EmailService } from "@sitehaus-ecom/shared";
import { render } from "@react-email/render";
import {
  OrderConfirmed,
  OrderDelivered,
  OrderShipped,
  RefundIssued,
  ReturnRequested,
  ReturnRefunded,
} from "@sitehaus-ecom/email-templates";

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
      case "order.delivered":
        return this.handleOrderDelivered(job);
      case "order.refunded":
        return this.handleOrderRefunded(job);
      case "order.return_requested":
        return this.handleReturnRequested(job);
      case "order.return_refunded":
        return this.handleReturnRefunded(job);
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
      OrderConfirmed({
        storeName: store?.name ?? "Your Store",
        name: order.shippingName ?? order.email,
        orderNumber: ref,
        orderDate: new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(new Date(order.createdAt)),
        items,
        subtotal: order.subtotalCents / 100,
        shipping: order.shippingCents / 100,
        tax: order.taxCents / 100,
        total: order.totalCents / 100,
        currency: order.currency,
        shippingName: order.shippingName ?? "",
        shippingLine1: order.shippingLine1 ?? "",
        shippingLine2: order.shippingLine2,
        shippingCity: order.shippingCity ?? "",
        shippingState: order.shippingState,
        shippingZip: order.shippingZip ?? "",
        shippingCountry: order.shippingCountry ?? "",
        supportEmail: "support@sitehaus.dev",
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

    const ref = orderId.slice(0, 8).toUpperCase();

    const html = await render(
      OrderShipped({
        storeName: store?.name ?? "Your Store",
        name: order.shippingName ?? order.email,
        orderNumber: ref,
        items,
        subtotal: order.subtotalCents / 100,
        shipping: order.shippingCents / 100,
        tax: order.taxCents / 100,
        total: order.totalCents / 100,
        currency: order.currency,
        trackingNumber: order.trackingNumber ?? "",
        trackingUrl: null,
        carrier: null,
        estimatedDelivery: null,
        shippingName: order.shippingName ?? "",
        shippingLine1: order.shippingLine1 ?? "",
        shippingLine2: order.shippingLine2,
        shippingCity: order.shippingCity ?? "",
        shippingState: order.shippingState,
        shippingZip: order.shippingZip ?? "",
        shippingCountry: order.shippingCountry ?? "",
        supportEmail: "support@sitehaus.dev",
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

  private async handleOrderDelivered(job: Job): Promise<void> {
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
      OrderDelivered({
        storeName: store?.name ?? "Your Store",
        name: order.shippingName ?? order.email,
        orderNumber: ref,
        orderDate: new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(new Date(order.createdAt)),
        deliveredDate: new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(new Date(order.deliveredAt!)),
        items,
        subtotal: order.subtotalCents / 100,
        shipping: order.shippingCents / 100,
        tax: order.taxCents / 100,
        total: order.totalCents / 100,
        currency: order.currency,
        shippingName: order.shippingName ?? "",
        shippingLine1: order.shippingLine1 ?? "",
        shippingLine2: order.shippingLine2,
        shippingCity: order.shippingCity ?? "",
        shippingState: order.shippingState,
        shippingZip: order.shippingZip ?? "",
        shippingCountry: order.shippingCountry ?? "",
        trackingNumber: order.trackingNumber,
        reviewUrl: `https://sitehaus.dev/review/${ref}`,
        supportEmail: "support@sitehaus.dev",
      }),
    );

    const recipients: string[] = [order.email];
    if (store?.notificationEmail) recipients.push(store.notificationEmail);

    await this.email.send({
      to: recipients,
      from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
      subject: `Your order has been delivered! — #${ref}`,
      html,
    });

    this.logger.log(`Order delivered email sent for order ${orderId} to ${recipients.join(", ")}`);
  }

  private async handleOrderRefunded(job: Job): Promise<void> {
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
      RefundIssued({
        storeName: store?.name ?? "Your Store",
        name: order.shippingName ?? order.email,
        orderNumber: ref,
        items,
        refundAmount: order.totalCents / 100,
        currency: order.currency,
        refundMethod: "Original payment method",
        estimatedDays: 5,
        supportEmail: "support@sitehaus.dev",
      }),
    );

    const recipients: string[] = [order.email];
    if (store?.notificationEmail) recipients.push(store.notificationEmail);

    await this.email.send({
      to: recipients,
      from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
      subject: `Your refund has been processed — #${ref}`,
      html,
    });

    this.logger.log(`Refund email sent for order ${orderId} to ${recipients.join(", ")}`);
  }

  private async handleReturnRequested(job: Job): Promise<void> {
    const { orderId, storeId, returnReason } = job.data as {
      orderId: string;
      storeId: string;
      returnReason: string;
    };

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
      ReturnRequested({
        storeName: store?.name ?? "Your Store",
        name: order.shippingName ?? order.email,
        orderNumber: ref,
        returnRequestDate: new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(new Date()),
        items,
        returnReason,
        returnPortalUrl: `https://sitehaus.dev/returns/${ref}`,
        supportEmail: "support@sitehaus.dev",
      }),
    );

    const recipients: string[] = [order.email];
    if (store?.notificationEmail) recipients.push(store.notificationEmail);

    await this.email.send({
      to: recipients,
      from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
      subject: `Return request received — #${ref}`,
      html,
    });

    this.logger.log(`Return requested email sent for order ${orderId}`);
  }

  private async handleReturnRefunded(job: Job): Promise<void> {
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
      ReturnRefunded({
        storeName: store?.name ?? "Your Store",
        name: order.shippingName ?? order.email,
        orderNumber: ref,
        items,
        refundAmount: order.totalCents / 100,
        currency: order.currency,
        refundMethod: "Original payment method",
        refundDate: new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(new Date()),
        estimatedDays: 5,
        supportEmail: "support@sitehaus.dev",
      }),
    );

    const recipients: string[] = [order.email];
    if (store?.notificationEmail) recipients.push(store.notificationEmail);

    await this.email.send({
      to: recipients,
      from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
      subject: `Your return has been refunded — #${ref}`,
      html,
    });

    this.logger.log(`Return refunded email sent for order ${orderId}`);
  }
}
