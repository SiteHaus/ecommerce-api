import { eq, storesTable } from "@sitehaus-ecom/database";
import type { Job } from "bullmq";
import type { HandlerContext } from "./handler.context";

export async function handleAbandonedCart(job: Job, ctx: HandlerContext): Promise<void> {
  const { cartId, storeId } = job.data as {
    cartId: string;
    storeId: string;
    customerEmail: string;
    customerName?: string;
  };
  const { db, logger } = ctx;

  const store = await db.query.storesTable.findFirst({
    where: eq(storesTable.id, storeId),
    columns: { name: true, abandonedCartEmailsEnabled: true },
  });

  if (!store?.abandonedCartEmailsEnabled) {
    logger.log(`Abandoned cart emails disabled for store ${storeId}, skipping cart ${cartId}`);
    return;
  }

  logger.warn(`Abandoned cart handler not fully implemented: cart ${cartId}, store ${storeId}`);
}
