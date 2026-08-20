import { eq, productsTable, productVariantsTable, storesTable } from "@sitehaus-ecom/database";
import { render } from "@react-email/render";
import { LowStock } from "@sitehaus-ecom/email-templates";
import type { Job } from "bullmq";
import type { HandlerContext } from "./handler.context";
import { logNotification } from "./log-notification";

export async function handleLowStock(job: Job, ctx: HandlerContext): Promise<void> {
  const { storeId, variantId, stock, available, lowStockThreshold } = job.data as {
    storeId: string;
    variantId: string;
    stock: number;
    reserved: number;
    available: number;
    lowStockThreshold: number;
  };
  const { db, email, logger } = ctx;

  const store = await db.query.storesTable.findFirst({
    where: eq(storesTable.id, storeId),
    columns: { name: true, notificationEmail: true, notificationPreferences: true },
  });

  // Same gate every other merchant alert uses. lowStock is opt-out (defaults on).
  if (!store?.notificationEmail || store.notificationPreferences?.lowStock === false) {
    return;
  }

  const [variant] = await db
    .select({
      variantName: productVariantsTable.name,
      sku: productVariantsTable.sku,
      productName: productsTable.name,
    })
    .from(productVariantsTable)
    .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
    .where(eq(productVariantsTable.id, variantId));

  if (!variant) {
    logger.error(`Variant ${variantId} not found for low-stock notification`);
    return;
  }

  const html = await render(
    LowStock({
      storeName: store.name,
      productName: variant.productName,
      variantName: variant.variantName,
      sku: variant.sku,
      stock,
      available,
      lowStockThreshold,
    }),
  );

  try {
    await email.send({
      to: store.notificationEmail,
      from: email.orderFrom(`${store.name} Inventory`),
      subject: `Low stock — ${variant.productName} (${variant.variantName})`,
      html,
    });
    await logNotification(ctx, {
      storeId,
      recipientEmail: store.notificationEmail,
      event: "merchant.low_stock",
      status: "sent",
    });
    logger.log(`Low-stock notification sent for variant ${variantId}`);
  } catch (error) {
    logger.error(`Failed to send low-stock notification: ${error}`);
    await logNotification(ctx, {
      storeId,
      recipientEmail: store.notificationEmail,
      event: "merchant.low_stock",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
