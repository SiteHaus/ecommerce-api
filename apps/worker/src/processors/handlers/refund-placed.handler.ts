import { eq, orderItemsTable, ordersTable, storesTable } from "@sitehaus-ecom/database";
import { render } from "@react-email/render";
import { RefundPlaced } from "@sitehaus-ecom/email-templates";
import type { Job } from "bullmq";
import type { HandlerContext } from "./handler.context";
import { logNotification } from "./log-notification";

export async function handleRefundPlaced(job: Job, ctx: HandlerContext): Promise<void> {
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
      columns: { name: true, slug: true, notificationEmail: true, notificationPreferences: true },
    }),
  ]);

  // Merchant-only, mirrors order-placed.handler.ts. The customer's own refund
  // emails are refund-issued.handler.ts (order refund) and
  // return-refunded.handler.ts (return refund) — this never goes to them.
  if (!store?.notificationEmail || store.notificationPreferences?.paymentFailed === false) {
    return;
  }

  const ref = orderId.slice(0, 8).toUpperCase();
  const dashboardUrl = `https://commerce.sitehaus.dev/${store.slug}/orders/${orderId}`;

  // We only support refunding an order in full today (see order-refunded.handler.ts,
  // same order.totalCents used for the amount) — no partial-refund tracking exists
  // yet, so refundAmount and orderTotal are always equal here.
  const html = await render(
    RefundPlaced({
      storeName: store.name,
      orderNumber: ref,
      customerName: order.shippingName ?? order.email,
      customerEmail: order.email,
      items,
      refundAmount: order.totalCents / 100,
      orderTotal: order.totalCents / 100,
      currency: order.currency,
      refundMethod: "Original payment method",
      refundDate: new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
      reason: null,
      initiatedBy: null,
      dashboardUrl,
    }),
  );

  try {
    await email.send({
      to: store.notificationEmail,
      from: email.orderFrom(`${store.name} Orders`),
      subject: `Refund placed — #${ref}`,
      html,
    });
    await logNotification(ctx, {
      storeId,
      recipientEmail: store.notificationEmail,
      event: "refund.placed",
      status: "sent",
    });
    logger.log(`Refund placed email sent for ${orderId}`);
  } catch (error) {
    logger.error(`Failed to send refund placed email: ${error}`);
    await logNotification(ctx, {
      storeId,
      recipientEmail: store.notificationEmail,
      event: "refund.placed",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
