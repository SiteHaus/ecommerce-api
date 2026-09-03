import { eq, orderItemsTable, ordersTable, storesTable } from "@sitehaus-ecom/database";
import { render } from "@react-email/render";
import { OrderPlaced } from "@sitehaus-ecom/email-templates";
import type { Job } from "bullmq";
import type { HandlerContext } from "./handler.context";
import { getShippingStreet } from "./get-shipping-street";
import { logNotification } from "./log-notification";

export async function handleOrderPlaced(job: Job, ctx: HandlerContext): Promise<void> {
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
      columns: { name: true, slug: true, notificationEmail: true, notificationPreferences: true },
    }),
  ]);

  // Merchant notification — not the customer's. See order-confirmed.handler.ts
  // for the customer-facing "Order confirmed" email; this is the "hey, you got
  // a sale" email for the store owner, so it's gated by the same notification
  // preference and simply skips when no notification email is on file.
  if (!store?.notificationEmail || store.notificationPreferences?.newOrder === false) {
    return;
  }

  // The admin app routes by slug (app/[storeSlug]/...), not by display name —
  // store.name is a human-readable label like "OneHealth Clinics" and would
  // produce a URL that 404s.
  const storeUrl = `https://commerce.sitehaus.dev/${store.slug}/orders/${orderId}`;

  const ref = orderId.slice(0, 8).toUpperCase();

  const html = await render(
    OrderPlaced({
      storeName: store?.name ?? "Your Store",
      name: order.shippingName ?? order.email,
      orderNumber: ref,
      orderDate: new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(order.createdAt)),
      orderId: order.id,
      items,
      subtotal: order.subtotalCents / 100,
      shipping: order.shippingCents / 100,
      tax: order.taxCents / 100,
      total: order.totalCents / 100,
      currency: order.currency,
      shippingName: order.shippingName ?? "",
      shippingLine1: street.line1 ?? "",
      shippingLine2: street.line2,
      shippingCity: order.shippingCity ?? "",
      shippingState: order.shippingState,
      shippingZip: order.shippingZip ?? "",
      shippingCountry: order.shippingCountry ?? "",
      trackingNumber: order.trackingNumber,
      storeUrl: storeUrl,
      supportEmail: "hello@sitehaus.dev",
    }),
  );

  try {
    await email.send({
      to: store.notificationEmail,
      from: email.orderFrom(`${store.name} Orders`),
      subject: `An order has been placed! — #${ref}`,
      html,
    });
    await logNotification(ctx, {
      storeId,
      recipientEmail: store.notificationEmail,
      event: "order.placed",
      status: "sent",
    });
    logger.log(`Order placed email sent for ${orderId}`);
  } catch (error) {
    logger.error(`Failed to send order placed email: ${error}`);
    await logNotification(ctx, {
      storeId,
      recipientEmail: store.notificationEmail,
      event: "order.placed",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
