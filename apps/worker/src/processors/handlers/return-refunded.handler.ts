import { eq, orderItemsTable, ordersTable, storesTable } from "@sitehaus-ecom/database";
import { render } from "@react-email/render";
import { ReturnRefunded } from "@sitehaus-ecom/email-templates";
import type { Job } from "bullmq";
import type { HandlerContext } from "./handler.context";
import { logNotification } from "./log-notification";

export async function handleReturnRefunded(job: Job, ctx: HandlerContext): Promise<void> {
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
    await email.send({
      to: order.email,
      from: `${store?.name ?? "Your Store"} <orders@sitehaus.io>`,
      subject: `Your return has been refunded — #${ref}`,
      html,
    });
    await logNotification(ctx, {
      storeId,
      recipientEmail: order.email,
      event: "order.return_refunded",
      status: "sent",
    });
    logger.log(`Return refunded email sent for ${orderId}`);
  } catch (error) {
    logger.error(`Failed to send return refunded email: ${error}`);
    await logNotification(ctx, {
      storeId,
      recipientEmail: order.email,
      event: "order.return_refunded",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
