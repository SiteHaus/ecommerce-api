import { Inject, Injectable, Logger } from "@nestjs/common";
import { DB_TOKEN } from "../db/db.module.js";
import { storeAuditLogsTable } from "@sitehaus-ecom/database";
import type { Db } from "@sitehaus-ecom/database";

export interface AuditEntry {
  storeId: string;
  userId?: string;
  action: string; // e.g. 'product.created', 'order.confirmed'
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  // Fire-and-forget — never await in hot paths
  log(entry: AuditEntry): Promise<void> {
    return this.db
      .insert(storeAuditLogsTable)
      .values({
        storeId: entry.storeId,
        userId: entry.userId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        meta: entry.meta,
      })
      .then(() => undefined)
      .catch((err: unknown) => {
        this.logger.error("Failed to write audit log", err);
      });
  }
}
