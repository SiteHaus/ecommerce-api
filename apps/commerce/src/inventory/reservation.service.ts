import { Inject, Injectable } from "@nestjs/common";
import { sql, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";

@Injectable()
export class ReservationService {
  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  /**
   * Atomically reserves inventory for a variant.
   *
   * Uses a single Postgres CTE to increment `inventory.reserved` and insert
   * the reservation row in one round-trip. Zero rows returned = sold out.
   */
  async reserve(
    variantId: string,
    orderId: string,
    storeId: string,
    quantity: number,
  ): Promise<"reserved" | "sold_out"> {
    const ttlResult = await this.db.execute(sql`
      SELECT reservation_ttl_minutes
      FROM stores
      WHERE id = ${storeId}::uuid
      LIMIT 1
    `);

    const ttlMinutes = (ttlResult.rows[0]?.reservation_ttl_minutes as number) ?? 15;

    const result = await this.db.execute(sql`
      WITH reserve AS (
        UPDATE inventory
        SET reserved = reserved + ${quantity}
        WHERE variant_id     = ${variantId}::uuid
          AND store_id       = ${storeId}::uuid
          AND (allow_backorder = true OR (stock - reserved) >= ${quantity})
        RETURNING variant_id
      )
      INSERT INTO reservations (variant_id, order_id, store_id, quantity, expires_at)
      SELECT variant_id,
             ${orderId}::uuid,
             ${storeId}::uuid,
             ${quantity},
             now() + (${ttlMinutes} * interval '1 minute')
      FROM reserve
      RETURNING id
    `);

    return result.rows.length > 0 ? "reserved" : "sold_out";
  }

  /**
   * Releases all reservations for an order and restores inventory.reserved.
   *
   * Called when checkout fails partway through (e.g. one item sold out after
   * others were reserved, or Stripe error).
   */
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

  /**
   * Commits reservations for an order after successful payment.
   *
   * Decrements both `stock` and `reserved` so the units are permanently sold.
   */
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

  /**
   * Expires stale reservations and frees their held inventory.
   *
   * Called by the BullMQ worker on a recurring schedule. Returns the number
   * of reservations that were released.
   */
  async expireStale(): Promise<number> {
    const result = await this.db.execute(sql`
      WITH expired AS (
        DELETE FROM reservations
        WHERE expires_at < now()
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
