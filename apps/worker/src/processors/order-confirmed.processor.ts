import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import {
  eq,
  notificationLogsTable,
  orderItemsTable,
  ordersTable,
  storesTable,
  type Db,
} from "@sitehaus-ecom/database";
import { DB_TOKEN, EmailService } from "@sitehaus-ecom/shared";
import { render } from "@react-email/render";
import {
  AbandonedCart,
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
      case "cart.abandoned":
        return this.handleAbandonedCart(job);
      default:
        this.logger.warn(`Unhandled notification job: ${job.name}`);
    }
  }

  private async logNotification(data: {
    storeId: string;
    recipientEmail: string;
    event: string;
    status: "sent" | "failed";
    resendMessageId?: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.db.insert(notificationLogsTable).values({
        storeId: data.storeId,
        recipientEmail: data.recipientEmail,
        event: data.event,
        status: data.status,
        resendMessageId: data.resendMessageId,
        errorMessage: data.errorMessage,
      });
    } catch (error) {
      this.logger.error(`Failed to log notification: ${error}`);
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

    // Send to customer
    try {
      await this.email.send({
        to: order.email,
        from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
        subject: `Order confirmed — #${ref}`,
        html,
      });

      await this.logNotification({
        storeId,
        recipientEmail: order.email,
        event: "order.confirmed",
        status: "sent",
      });

      this.logger.log(`Order confirmation email sent for order ${orderId} to ${order.email}`);
    } catch (error) {
      this.logger.error(`Failed to send order confirmation to ${order.email}: ${error}`);
      await this.logNotification({
        storeId,
        recipientEmail: order.email,
        event: "order.confirmed",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    // Send merchant notification if enabled
    if (store?.notificationEmail && store.notificationPreferences?.newOrder !== false) {
      try {
        await this.email.send({
          to: store.notificationEmail,
          from: `${store.name} Orders <orders@sitehaus.io>`,
          subject: `New order received — #${ref}`,
          html,
        });

        await this.logNotification({
          storeId,
          recipientEmail: store.notificationEmail,
          event: "merchant.new_order",
          status: "sent",
        });

        this.logger.log(`Merchant notification sent for order ${orderId}`);
      } catch (error) {
        this.logger.error(`Failed to send merchant notification: ${error}`);
        await this.logNotification({
          storeId,
          recipientEmail: store.notificationEmail,
          event: "merchant.new_order",
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
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

    try {
      await this.email.send({
        to: order.email,
        from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
        subject: `Your order has shipped! — #${ref}`,
        html,
      });

      await this.logNotification({
        storeId,
        recipientEmail: order.email,
        event: "order.shipped",
        status: "sent",
      });

      this.logger.log(`Order shipped email sent for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to send order shipped email: ${error}`);
      await this.logNotification({
        storeId,
        recipientEmail: order.email,
        event: "order.shipped",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
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

    try {
      await this.email.send({
        to: order.email,
        from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
        subject: `Your order has been delivered! — #${ref}`,
        html,
      });

      await this.logNotification({
        storeId,
        recipientEmail: order.email,
        event: "order.delivered",
        status: "sent",
      });

      this.logger.log(`Order delivered email sent for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to send order delivered email: ${error}`);
      await this.logNotification({
        storeId,
        recipientEmail: order.email,
        event: "order.delivered",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
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

    try {
      await this.email.send({
        to: order.email,
        from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
        subject: `Your refund has been processed — #${ref}`,
        html,
      });

      await this.logNotification({
        storeId,
        recipientEmail: order.email,
        event: "order.refunded",
        status: "sent",
      });

      this.logger.log(`Refund email sent for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to send refund email: ${error}`);
      await this.logNotification({
        storeId,
        recipientEmail: order.email,
        event: "order.refunded",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
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

    try {
      await this.email.send({
        to: order.email,
        from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
        subject: `Return request received — #${ref}`,
        html,
      });

      await this.logNotification({
        storeId,
        recipientEmail: order.email,
        event: "order.return_requested",
        status: "sent",
      });

      this.logger.log(`Return requested email sent for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to send return requested email: ${error}`);
      await this.logNotification({
        storeId,
        recipientEmail: order.email,
        event: "order.return_requested",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    // Send merchant notification if enabled
    if (store?.notificationEmail && store.notificationPreferences?.returnRequested !== false) {
      try {
        await this.email.send({
          to: store.notificationEmail,
          from: `${store.name} Orders <orders@sitehaus.io>`,
          subject: `Return requested — #${ref}`,
          html,
        });

        await this.logNotification({
          storeId,
          recipientEmail: store.notificationEmail,
          event: "merchant.return_requested",
          status: "sent",
        });

        this.logger.log(`Merchant return notification sent for order ${orderId}`);
      } catch (error) {
        this.logger.error(`Failed to send merchant return notification: ${error}`);
        await this.logNotification({
          storeId,
          recipientEmail: store.notificationEmail,
          event: "merchant.return_requested",
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
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

    try {
      await this.email.send({
        to: order.email,
        from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
        subject: `Your return has been refunded — #${ref}`,
        html,
      });

      await this.logNotification({
        storeId,
        recipientEmail: order.email,
        event: "order.return_refunded",
        status: "sent",
      });

      this.logger.log(`Return refunded email sent for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to send return refunded email: ${error}`);
      await this.logNotification({
        storeId,
        recipientEmail: order.email,
        event: "order.return_refunded",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleAbandonedCart(job: Job): Promise<void> {
    const { cartId, storeId, customerEmail, customerName } = job.data as {
      cartId: string;
      storeId: string;
      customerEmail: string;
      customerName?: string;
    };

    // Check if store has abandoned cart emails enabled
    const store = await this.db.query.storesTable.findFirst({
      where: eq(storesTable.id, storeId),
      columns: {
        name: true,
        abandonedCartEmailsEnabled: true,
      },
    });

    if (!store?.abandonedCartEmailsEnabled) {
      this.logger.log(
        `Abandoned cart emails disabled for store ${storeId}, skipping cart ${cartId}`,
      );
      return;
    }

    // TODO: Fetch cart items and build recovery URL
    // For now, this is a placeholder until cart recovery is fully implemented
    this.logger.warn(
      `Abandoned cart handler called but not fully implemented: cart ${cartId}, store ${storeId}`,
    );

    // Once implemented, structure:
    // 1. Fetch cart items from DB
    // 2. Generate cart recovery token/URL
    // 3. Render AbandonedCart template
    // 4. Send email with try/catch + notification logging
  }
}
