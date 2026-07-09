import { eq, orderItemsTable, ordersTable, storesTable } from "@sitehaus-ecom/database";
import { render } from "@react-email/render";
import { OrderDelivered } from "@sitehaus-ecom/email-templates";
import type { Job } from "bullmq";
import type { HandlerContext } from "./handler.context";
import { logNotification } from "./log-notification";

export async function handleOrderDelivered(job: Job, ctx: HandlerContext): Promise<void> {
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
    await email.send({
      to: order.email,
      from: email.orderFrom(store?.name ?? "Your Store"),
      subject: `Your order has been delivered! — #${ref}`,
      html,
    });
    await logNotification(ctx, {
      storeId,
      recipientEmail: order.email,
      event: "order.delivered",
      status: "sent",
    });
    logger.log(`Order delivered email sent for ${orderId}`);
  } catch (error) {
    logger.error(`Failed to send order delivered email: ${error}`);
    await logNotification(ctx, {
      storeId,
      recipientEmail: order.email,
      event: "order.delivered",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
