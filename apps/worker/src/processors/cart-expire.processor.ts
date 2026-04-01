import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { Db, sql } from "@sitehaus-ecom/database";

@Processor("ecom-orders")
export class CartExpireProcessor extends WorkerHost {
  private readonly logger = new Logger(CartExpireProcessor.name);

  constructor(@Inject(DB_TOKEN) private readonly db: Db) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "cart.expire") return;
    const deleted = await this.expireStale();
    if (deleted > 0) this.logger.log(`Deleted ${deleted} expired carts`);
  }

  private async expireStale(): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM carts
      WHERE id IN (
        SELECT id FROM carts
        WHERE expires_at < now()
        LIMIT 100
      )
    `);
    return result.rowCount ?? 0;
  }
}
