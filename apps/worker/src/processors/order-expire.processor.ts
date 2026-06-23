import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { Db, sql } from "@sitehaus-ecom/database";

@Processor("ecom-orders")
export class OrderExpireProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderExpireProcessor.name);

  constructor(@Inject(DB_TOKEN) private readonly db: Db) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "order.expire") return;
    const cancelled = await this.cancelStale();
    if (cancelled > 0) this.logger.log(`Cancelled ${cancelled} abandoned orders`);
  }

  private async cancelStale(): Promise<number> {
    const result = await this.db.execute(sql`
      UPDATE orders
      SET status = 'cancelled', updated_at = now()
      WHERE id IN (
        SELECT id FROM orders
        WHERE status = 'pending'
          AND created_at < now() - interval '72 hours'
        LIMIT 200
      )
    `);
    return result.rowCount ?? 0;
  }
}
