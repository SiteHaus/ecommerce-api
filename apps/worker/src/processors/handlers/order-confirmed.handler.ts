import { eq, orderItemsTable, ordersTable, storesTable } from "@sitehaus-ecom/database";
import { render } from "@react-email/render";
import { OrderConfirmed } from "@sitehaus-ecom/email-templates";
import type { Job } from "bullmq";
import type { HandlerContext } from "./handler.context";
import { logNotification } from "./log-notification";

export async function handleOrderConfirmed(job: Job, ctx: HandlerContext): Promise<void> {
  const { orderId, storeId } = job.data as { orderId: string; storeId: string };
  const { db, email, logger } = ctx;

  const order = await db.query.ordersTable.findFirst({ where: eq(ordersTable.id, orderId) });

  if (!order || order.storeId !== storeId) {
    logger.error(`Order ${orderId} not found for store ${storeId}`);
    return;
  }

  const [items, store] = await Promise.all([
    db
      .select({
        productName: orderItemsTable.productName,
        variantName: orderItemsTable.variantName,
        quantity: orderItemsTable.quantity,
        unitPriceCents: orderItemsTable.unitPriceCents,
        totalCents: orderItemsTable.totalCents,
      })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, orderId)),
    db.query.storesTable.findFirst({
      where: eq(storesTable.id, storeId),
      columns: { name: true, notificationEmail: true, notificationPreferences: true },
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

  try {
    await email.send({
      to: order.email,
      from: email.orderFrom(store?.name ?? "Your Store"),
      subject: `Order confirmed — #${ref}`,
      html,
    });
    await logNotification(ctx, {
      storeId,
      recipientEmail: order.email,
      event: "order.confirmed",
      status: "sent",
    });
    logger.log(`Order confirmation sent for ${orderId} to ${order.email}`);
  } catch (error) {
    logger.error(`Failed to send order confirmation to ${order.email}: ${error}`);
    await logNotification(ctx, {
      storeId,
      recipientEmail: order.email,
      event: "order.confirmed",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  if (store?.notificationEmail && store.notificationPreferences?.newOrder !== false) {
    try {
      await email.send({
        to: store.notificationEmail,
        from: email.orderFrom(`${store.name} Orders`),
        subject: `New order received — #${ref}`,
        html,
      });
      await logNotification(ctx, {
        storeId,
        recipientEmail: store.notificationEmail,
        event: "merchant.new_order",
        status: "sent",
      });
      logger.log(`Merchant new order notification sent for ${orderId}`);
    } catch (error) {
      logger.error(`Failed to send merchant new order notification: ${error}`);
      await logNotification(ctx, {
        storeId,
        recipientEmail: store.notificationEmail,
        event: "merchant.new_order",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
