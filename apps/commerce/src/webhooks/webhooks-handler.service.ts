import { Inject, Injectable } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import * as crypto from "node:crypto";
import {
  and,
  desc,
  eq,
  type Db,
  webhookDeliveriesTable,
  webhookEndpointsTable,
} from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";

@Injectable()
export class WebhooksHandlerService {
  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  async list(storeId: string) {
    const rows = await this.db
      .select({
        id: webhookEndpointsTable.id,
        url: webhookEndpointsTable.url,
        events: webhookEndpointsTable.events,
        isActive: webhookEndpointsTable.isActive,
        createdAt: webhookEndpointsTable.createdAt,
        updatedAt: webhookEndpointsTable.updatedAt,
      })
      .from(webhookEndpointsTable)
      .where(eq(webhookEndpointsTable.storeId, storeId))
      .orderBy(desc(webhookEndpointsTable.createdAt));

    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async create(storeId: string, data: { url: string; events: string[] }) {
    const secret = crypto.randomBytes(32).toString("hex");

    const [endpoint] = await this.db
      .insert(webhookEndpointsTable)
      .values({ storeId, url: data.url, secret, events: data.events })
      .returning();

    return {
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      isActive: endpoint.isActive,
      secret,
      createdAt: endpoint.createdAt.toISOString(),
      updatedAt: endpoint.updatedAt.toISOString(),
    };
  }

  async update(
    storeId: string,
    endpointId: string,
    data: { url?: string; events?: string[]; isActive?: boolean },
  ) {
    const [updated] = await this.db
      .update(webhookEndpointsTable)
      .set({
        ...(data.url !== undefined && { url: data.url }),
        ...(data.events !== undefined && { events: data.events }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      })
      .where(
        and(eq(webhookEndpointsTable.id, endpointId), eq(webhookEndpointsTable.storeId, storeId)),
      )
      .returning();

    if (!updated) throw new RpcException({ status: 404, message: "Webhook endpoint not found" });

    return {
      id: updated.id,
      url: updated.url,
      events: updated.events,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async delete(storeId: string, endpointId: string) {
    const deleted = await this.db
      .delete(webhookEndpointsTable)
      .where(
        and(eq(webhookEndpointsTable.id, endpointId), eq(webhookEndpointsTable.storeId, storeId)),
      )
      .returning({ id: webhookEndpointsTable.id });

    if (deleted.length === 0)
      throw new RpcException({ status: 404, message: "Webhook endpoint not found" });
  }

  async listDeliveries(storeId: string, endpointId: string) {
    const endpoint = await this.db.query.webhookEndpointsTable.findFirst({
      where: and(
        eq(webhookEndpointsTable.id, endpointId),
        eq(webhookEndpointsTable.storeId, storeId),
      ),
    });
    if (!endpoint) throw new RpcException({ status: 404, message: "Webhook endpoint not found" });

    const rows = await this.db
      .select({
        id: webhookDeliveriesTable.id,
        endpointId: webhookDeliveriesTable.endpointId,
        event: webhookDeliveriesTable.event,
        status: webhookDeliveriesTable.status,
        attemptCount: webhookDeliveriesTable.attemptCount,
        lastAttemptAt: webhookDeliveriesTable.lastAttemptAt,
        responseStatus: webhookDeliveriesTable.responseStatus,
        createdAt: webhookDeliveriesTable.createdAt,
      })
      .from(webhookDeliveriesTable)
      .where(eq(webhookDeliveriesTable.endpointId, endpointId))
      .orderBy(desc(webhookDeliveriesTable.createdAt))
      .limit(50);

    return rows.map((r) => ({
      ...r,
      lastAttemptAt: r.lastAttemptAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
