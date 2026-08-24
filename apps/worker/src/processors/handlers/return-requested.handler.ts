import { eq, orderItemsTable, ordersTable, storesTable } from "@sitehaus-ecom/database";
import { render } from "@react-email/render";
import { ReturnRequested } from "@sitehaus-ecom/email-templates";
import type { Job } from "bullmq";
import type { HandlerContext } from "./handler.context";
import { logNotification } from "./log-notification";

export async function handleReturnRequested(job: Job, ctx: HandlerContext): Promise<void> {
  const { orderId, storeId, returnReason } = job.data as {
    orderId: string;
    storeId: string;
    returnReason: string;
  };
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
      // No client site has a /returns tracking page yet — omitting hides
      // the button instead of linking to a 404. See SIT-313.
      returnPortalUrl: null,
      supportEmail: "support@sitehaus.dev",
    }),
  );

  try {
    await email.send({
      to: order.email,
      from: email.orderFrom(store?.name ?? "Your Store"),
      subject: `Return request received — #${ref}`,
      html,
    });
    await logNotification(ctx, {
      storeId,
      recipientEmail: order.email,
      event: "order.return_requested",
      status: "sent",
    });
    logger.log(`Return requested email sent for ${orderId}`);
  } catch (error) {
    logger.error(`Failed to send return requested email: ${error}`);
    await logNotification(ctx, {
      storeId,
      recipientEmail: order.email,
      event: "order.return_requested",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  if (store?.notificationEmail && store.notificationPreferences?.returnRequested !== false) {
    try {
      await email.send({
        to: store.notificationEmail,
        from: email.orderFrom(`${store.name} Orders`),
        subject: `Return requested — #${ref}`,
        html,
      });
      await logNotification(ctx, {
        storeId,
        recipientEmail: store.notificationEmail,
        event: "merchant.return_requested",
        status: "sent",
      });
      logger.log(`Merchant return notification sent for ${orderId}`);
    } catch (error) {
      logger.error(`Failed to send merchant return notification: ${error}`);
      await logNotification(ctx, {
        storeId,
        recipientEmail: store.notificationEmail,
        event: "merchant.return_requested",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
