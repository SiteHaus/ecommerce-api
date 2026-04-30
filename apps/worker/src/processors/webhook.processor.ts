import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import * as crypto from "node:crypto";
import {
  and,
  eq,
  type Db,
  webhookDeliveriesTable,
  webhookEndpointsTable,
} from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";

type DispatchPayload = {
  storeId: string;
  event: string;
  data: Record<string, unknown>;
};

type DeliverPayload = {
  deliveryId: string;
  url: string;
  secret: string;
  body: string;
};

@Injectable()
@Processor("ecom-webhooks")
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    @InjectQueue("ecom-webhooks") private readonly webhooksQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case "webhook.dispatch":
        return this.handleDispatch(job);
      case "webhook.deliver":
        return this.handleDeliver(job);
      default:
        this.logger.warn(`Unhandled webhook job: ${job.name}`);
    }
  }

  private async handleDispatch(job: Job): Promise<void> {
    const { storeId, event, data } = job.data as DispatchPayload;

    const endpoints = await this.db
      .select()
      .from(webhookEndpointsTable)
      .where(
        and(eq(webhookEndpointsTable.storeId, storeId), eq(webhookEndpointsTable.isActive, true)),
      );

    const matching = endpoints.filter((ep) => (ep.events as string[]).includes(event));
    if (matching.length === 0) return;

    const timestamp = new Date().toISOString();
    const bodyObj = { event, storeId, timestamp, data };
    const body = JSON.stringify(bodyObj);

    for (const endpoint of matching) {
      const [delivery] = await this.db
        .insert(webhookDeliveriesTable)
        .values({ endpointId: endpoint.id, event, payload: bodyObj, status: "pending" })
        .returning({ id: webhookDeliveriesTable.id });

      void this.webhooksQueue.add(
        "webhook.deliver",
        {
          deliveryId: delivery.id,
          url: endpoint.url,
          secret: endpoint.secret,
          body,
        } satisfies DeliverPayload,
        { attempts: 5, backoff: { type: "exponential", delay: 10_000 } },
      );
    }

    this.logger.log(`Dispatched ${matching.length} webhook(s) for ${event} on store ${storeId}`);
  }

  private async handleDeliver(job: Job): Promise<void> {
    const { deliveryId, url, secret, body } = job.data as DeliverPayload;

    const signature = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;

    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let success = false;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SiteHaus-Signature": signature,
          "User-Agent": "SiteHaus-Webhooks/1.0",
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      responseStatus = res.status;
      const text = await res.text().catch(() => "");
      responseBody = text.slice(0, 500) || null;
      success = res.ok;
    } catch (err: any) {
      this.logger.error(`Webhook delivery to ${url} failed: ${err.message}`);
    }

    await this.db
      .update(webhookDeliveriesTable)
      .set({
        status: success ? "delivered" : "failed",
        attemptCount: job.attemptsMade,
        lastAttemptAt: new Date(),
        responseStatus,
        responseBody,
      })
      .where(eq(webhookDeliveriesTable.id, deliveryId));

    if (!success) {
      throw new Error(
        `Webhook delivery failed: ${responseStatus != null ? `HTTP ${responseStatus}` : "network error"}`,
      );
    }

    this.logger.log(`Webhook delivered to ${url} (delivery ${deliveryId})`);
  }
}
