import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { Db, sql } from "@sitehaus-ecom/database";

@Processor("ecom-catalog")
export class PublishScheduledProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishScheduledProcessor.name);

  constructor(@Inject(DB_TOKEN) private readonly db: Db) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "catalog.publish-scheduled") return;
    const count = await this.publishScheduled();
    if (count > 0) this.logger.log(`Published ${count} scheduled product(s)`);
  }

  private async publishScheduled(): Promise<number> {
    const result = await this.db.execute(sql`
      UPDATE products
      SET status = 'active', updated_at = now()
      WHERE status = 'scheduled'
        AND goes_live_at <= now()
    `);
    return result.rowCount ?? 0;
  }
}
