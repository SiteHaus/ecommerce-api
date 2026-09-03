import { eq, orderItemsTable, ordersTable, storesTable } from "@sitehaus-ecom/database";
import { render } from "@react-email/render";
import { OrderShipped } from "@sitehaus-ecom/email-templates";
import type { Job } from "bullmq";
import type { HandlerContext } from "./handler.context";
import { getShippingStreet } from "./get-shipping-street";
import { logNotification } from "./log-notification";

export async function handleOrderShipped(job: Job, ctx: HandlerContext): Promise<void> {
  const { orderId, storeId } = job.data as { orderId: string; storeId: string };
  const { db, email, logger } = ctx;

  const order = await db.query.ordersTable.findFirst({ where: eq(ordersTable.id, orderId) });

  if (!order || order.storeId !== storeId) {
    logger.error(`Order ${orderId} not found for store ${storeId}`);
    return;
  }

  const street = await getShippingStreet(ctx, order);

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
      shippingLine1: street.line1 ?? "",
      shippingLine2: street.line2,
      shippingCity: order.shippingCity ?? "",
      shippingState: order.shippingState,
      shippingZip: order.shippingZip ?? "",
      shippingCountry: order.shippingCountry ?? "",
      supportEmail: "hello@sitehaus.dev",
    }),
  );

  try {
    await email.send({
      to: order.email,
      from: email.orderFrom(store?.name ?? "Your Store"),
      subject: `Your order has shipped! — #${ref}`,
      html,
    });
    await logNotification(ctx, {
      storeId,
      recipientEmail: order.email,
      event: "order.shipped",
      status: "sent",
    });
    logger.log(`Order shipped email sent for ${orderId}`);
  } catch (error) {
    logger.error(`Failed to send order shipped email: ${error}`);
    await logNotification(ctx, {
      storeId,
      recipientEmail: order.email,
      event: "order.shipped",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
