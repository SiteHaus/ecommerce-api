import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { Db, sql } from "@sitehaus-ecom/database";

@Processor("ecom-analytics")
export class AnalyticsRetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsRetentionProcessor.name);

  constructor(@Inject(DB_TOKEN) private readonly db: Db) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "analytics.purgeExpired") return;

    let total = 0;
    let deleted: number;

    do {
      deleted = await this.deleteBatch();
      total += deleted;
    } while (deleted > 0);

    if (total > 0) this.logger.log(`Deleted ${total} expired analytics events`);
  }

  private async deleteBatch(): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM analytics_events
      WHERE id IN (
        SELECT id FROM analytics_events
        WHERE created_at < now() - interval '90 days'
        LIMIT 500
      )
    `);
    return result.rowCount ?? 0;
  }
}
