import { notificationLogsTable } from "@sitehaus-ecom/database";
import type { HandlerContext } from "./handler.context";

export async function logNotification(
  ctx: HandlerContext,
  data: {
    storeId: string;
    recipientEmail: string;
    event: string;
    status: "sent" | "failed";
    resendMessageId?: string;
    errorMessage?: string;
  },
): Promise<void> {
  try {
    await ctx.db.insert(notificationLogsTable).values(data);
  } catch (error) {
    ctx.logger.error(`Failed to log notification: ${error}`);
  }
}
