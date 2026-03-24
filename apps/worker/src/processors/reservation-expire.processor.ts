import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { Db, sql } from "@sitehaus-ecom/database";

@Processor("ecom-inventory")
export class ReservationExpireProcessor extends WorkerHost {
  private readonly logger = new Logger(ReservationExpireProcessor.name);

  constructor(@Inject(DB_TOKEN) private readonly db: Db) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "reservation.expire") return;
    const released = await this.expireStale();
    if (released > 0) this.logger.log(`Released ${released} expired reservations`);
  }

  private async expireStale(): Promise<number> {
    // Batch to 100 to avoid long transactions during high-burst drop aftermath.
    // DELETE ... WHERE id IN (subquery) is the correct Postgres pattern for
    // batched deletes since LIMIT is not supported directly in DELETE.
    const result = await this.db.execute(sql`
      WITH expired AS (
        DELETE FROM reservations
        WHERE id IN (
          SELECT id FROM reservations
          WHERE expires_at < now()
          LIMIT 100
        )
        RETURNING id, variant_id, store_id, quantity
      ),
      updated AS (
        UPDATE inventory i
        SET reserved = GREATEST(0, i.reserved - e.total_qty)
        FROM (
          SELECT variant_id, store_id, SUM(quantity)::int AS total_qty
          FROM expired
          GROUP BY variant_id, store_id
        ) e
        WHERE i.variant_id = e.variant_id
          AND i.store_id   = e.store_id
      )
      SELECT COUNT(*)::int AS released FROM expired
    `);

    return (result.rows[0]?.released as number) ?? 0;
  }
}
