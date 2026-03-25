import { Inject, Injectable } from "@nestjs/common";
import { sql, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";

@Injectable()
export class ReservationService {
  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  async commit(orderId: string): Promise<void> {
    await this.db.execute(sql`
      WITH committed AS (
        DELETE FROM reservations
        WHERE order_id = ${orderId}::uuid
        RETURNING variant_id, store_id, quantity
      )
      UPDATE inventory i
      SET
        stock    = GREATEST(0, i.stock    - c.total_qty),
        reserved = GREATEST(0, i.reserved - c.total_qty)
      FROM (
        SELECT variant_id, store_id, SUM(quantity)::int AS total_qty
        FROM committed
        GROUP BY variant_id, store_id
      ) c
      WHERE i.variant_id = c.variant_id
        AND i.store_id   = c.store_id
    `);
  }

  async releaseByOrder(orderId: string): Promise<void> {
    await this.db.execute(sql`
      WITH released AS (
        DELETE FROM reservations
        WHERE order_id = ${orderId}::uuid
        RETURNING variant_id, store_id, quantity
      )
      UPDATE inventory i
      SET reserved = GREATEST(0, i.reserved - e.total_qty)
      FROM (
        SELECT variant_id, store_id, SUM(quantity)::int AS total_qty
        FROM released
        GROUP BY variant_id, store_id
      ) e
      WHERE i.variant_id = e.variant_id
        AND i.store_id   = e.store_id
    `);
  }
}
