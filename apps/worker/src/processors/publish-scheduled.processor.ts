import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { Db, sql } from "@sitehaus-ecom/database";

type PublishedRow = { id: string; store_id: string; name: string };

@Processor("ecom-catalog")
export class PublishScheduledProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishScheduledProcessor.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    @InjectQueue("ecom-webhooks") private readonly webhooksQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "catalog.publish-scheduled") return;
    const published = await this.publishScheduled();
    if (published.length === 0) return;

    this.logger.log(`Published ${published.length} scheduled product(s)`);
    for (const product of published) this.dispatchProductPublished(product);
  }

  private async publishScheduled(): Promise<PublishedRow[]> {
    // The UPDATE only matches rows still 'scheduled', so each product comes
    // back here exactly once, even if two runs overlap.
    const result = await this.db.execute(sql`
      UPDATE products
      SET status = 'active', updated_at = now()
      WHERE status = 'scheduled'
        AND goes_live_at <= now()
      RETURNING id, store_id, name
    `);
    return result.rows as PublishedRow[];
  }

  private dispatchProductPublished(product: PublishedRow) {
    void this.webhooksQueue
      .add("webhook.dispatch", {
        storeId: product.store_id,
        event: "product.published",
        data: { productId: product.id, name: product.name },
      })
      .catch((err: unknown) =>
        this.logger.warn(
          `Failed to enqueue product.published webhook dispatch for ${product.id}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  }
}
