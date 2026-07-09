import { eq, orderItemsTable, ordersTable, storesTable } from "@sitehaus-ecom/database";
import { render } from "@react-email/render";
import { RefundIssued } from "@sitehaus-ecom/email-templates";
import type { Job } from "bullmq";
import type { HandlerContext } from "./handler.context";
import { logNotification } from "./log-notification";

export async function handleOrderRefunded(job: Job, ctx: HandlerContext): Promise<void> {
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
    await email.send({
      to: order.email,
      from: `${store?.name ?? "Your Store"} <orders@notify.sitehaus.dev>`,
      subject: `Your refund has been processed — #${ref}`,
      html,
    });
    await logNotification(ctx, {
      storeId,
      recipientEmail: order.email,
      event: "order.refunded",
      status: "sent",
    });
    logger.log(`Refund email sent for ${orderId}`);
  } catch (error) {
    logger.error(`Failed to send refund email: ${error}`);
    await logNotification(ctx, {
      storeId,
      recipientEmail: order.email,
      event: "order.refunded",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  if (store?.notificationEmail && store.notificationPreferences?.paymentFailed !== false) {
    try {
      await email.send({
        to: store.notificationEmail,
        from: `${store.name} Orders <orders@notify.sitehaus.dev>`,
        subject: `Refund issued — #${ref}`,
        html,
      });
      await logNotification(ctx, {
        storeId,
        recipientEmail: store.notificationEmail,
        event: "merchant.order_refunded",
        status: "sent",
      });
      logger.log(`Merchant refund notification sent for ${orderId}`);
    } catch (error) {
      logger.error(`Failed to send merchant refund notification: ${error}`);
      await logNotification(ctx, {
        storeId,
        recipientEmail: store.notificationEmail,
        event: "merchant.order_refunded",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
