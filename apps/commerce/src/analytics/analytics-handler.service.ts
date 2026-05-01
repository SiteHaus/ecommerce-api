import { Inject, Injectable } from "@nestjs/common";
import {
  analyticsEventsTable,
  avg,
  count,
  countDistinct,
  desc,
  eq,
  orderItemsTable,
  ordersTable,
  productsTable,
  productVariantsTable,
  sql,
  sum,
  type Db,
} from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";

const PERIOD_TRUNC = {
  day: (col: typeof ordersTable.confirmedAt) => sql<Date>`date_trunc('day', ${col})`,
  week: (col: typeof ordersTable.confirmedAt) => sql<Date>`date_trunc('week', ${col})`,
  month: (col: typeof ordersTable.confirmedAt) => sql<Date>`date_trunc('month', ${col})`,
} as const;

const CONFIRMED_STATUSES = ["confirmed", "shipped", "delivered"] as const;

@Injectable()
export class AnalyticsHandlerService {
  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  async trackEvent(data: {
    storeId: string;
    sessionId: string;
    userId?: string;
    event: "product_viewed" | "add_to_cart" | "checkout_started" | "order_completed";
    productId?: string;
    variantId?: string;
    referrer?: string;
  }) {
    await this.db.insert(analyticsEventsTable).values({
      storeId: data.storeId,
      sessionId: data.sessionId,
      userId: data.userId ?? null,
      event: data.event,
      productId: data.productId ?? null,
      variantId: data.variantId ?? null,
      referrer: data.referrer ?? null,
    });
  }

  async revenue(data: {
    storeId: string;
    period: "day" | "week" | "month";
    from: string;
    to: string;
  }) {
    const { storeId, period, from, to } = data;
    const periodCol = PERIOD_TRUNC[period](ordersTable.confirmedAt);

    const rows = await this.db
      .select({
        date: periodCol,
        revenue: sum(ordersTable.totalCents),
        orderCount: count(),
        aov: avg(ordersTable.totalCents),
      })
      .from(ordersTable)
      .where(
        sql`${ordersTable.storeId} = ${storeId}
          AND ${ordersTable.status} = ANY(${CONFIRMED_STATUSES})
          AND ${ordersTable.confirmedAt} >= ${new Date(from)}
          AND ${ordersTable.confirmedAt} <= ${new Date(to)}`,
      )
      .groupBy(periodCol)
      .orderBy(periodCol);

    return {
      periods: rows.map((r) => ({
        date: (r.date as Date).toISOString().split("T")[0],
        revenue: Math.round(Number(r.revenue ?? 0)) / 100,
        orderCount: r.orderCount,
        aov: Math.round(Number(r.aov ?? 0)) / 100,
      })),
    };
  }

  async topProducts(data: { storeId: string; from: string; to: string; limit: number }) {
    const { storeId, from, to, limit } = data;
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const [byRevenue, byViews] = await Promise.all([
      this.db
        .select({
          productId: productVariantsTable.productId,
          name: productsTable.name,
          revenue: sum(orderItemsTable.totalCents),
        })
        .from(orderItemsTable)
        .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
        .innerJoin(productVariantsTable, eq(orderItemsTable.variantId, productVariantsTable.id))
        .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
        .where(
          sql`${ordersTable.storeId} = ${storeId}
            AND ${ordersTable.status} = ANY(${CONFIRMED_STATUSES})
            AND ${ordersTable.confirmedAt} >= ${fromDate}
            AND ${ordersTable.confirmedAt} <= ${toDate}`,
        )
        .groupBy(productVariantsTable.productId, productsTable.name)
        .orderBy(desc(sum(orderItemsTable.totalCents)))
        .limit(limit),

      this.db
        .select({
          productId: analyticsEventsTable.productId,
          name: productsTable.name,
          views: count(),
        })
        .from(analyticsEventsTable)
        .leftJoin(productsTable, eq(analyticsEventsTable.productId, productsTable.id))
        .where(
          sql`${analyticsEventsTable.storeId} = ${storeId}
            AND ${analyticsEventsTable.event} = 'product_viewed'
            AND ${analyticsEventsTable.productId} IS NOT NULL
            AND ${analyticsEventsTable.createdAt} >= ${fromDate}
            AND ${analyticsEventsTable.createdAt} <= ${toDate}`,
        )
        .groupBy(analyticsEventsTable.productId, productsTable.name)
        .orderBy(desc(count()))
        .limit(limit),
    ]);

    return {
      byRevenue: byRevenue.map((r) => ({
        productId: r.productId,
        name: r.name,
        revenue: Math.round(Number(r.revenue ?? 0)) / 100,
      })),
      byViews: byViews.map((r) => ({
        productId: r.productId,
        name: r.name,
        views: r.views,
      })),
    };
  }

  async funnel(data: { storeId: string; from: string; to: string }) {
    const { storeId, from, to } = data;
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const stages = [
      "product_viewed",
      "add_to_cart",
      "checkout_started",
      "order_completed",
    ] as const;

    const counts = await Promise.all(
      stages.map((event) =>
        this.db
          .select({ count: countDistinct(analyticsEventsTable.sessionId) })
          .from(analyticsEventsTable)
          .where(
            sql`${analyticsEventsTable.storeId} = ${storeId}
              AND ${analyticsEventsTable.event} = ${event}
              AND ${analyticsEventsTable.createdAt} >= ${fromDate}
              AND ${analyticsEventsTable.createdAt} <= ${toDate}`,
          )
          .then(([r]) => r.count),
      ),
    );

    return {
      stages: stages.map((stage, i) => ({
        stage,
        count: counts[i],
        conversionRate: i === 0 || counts[i - 1] === 0 ? null : counts[i] / counts[i - 1],
      })),
    };
  }

  async abandonedCarts(data: { storeId: string; from: string; to: string }) {
    const { storeId, from, to } = data;

    const result = await this.db.execute<{ total_carts_with_items: string; abandoned: string }>(
      sql`
        WITH checkout_sessions AS (
          SELECT DISTINCT session_id FROM analytics_events
          WHERE store_id = ${storeId}
            AND event = 'checkout_started'
            AND created_at BETWEEN ${new Date(from)} AND ${new Date(to)}
        ),
        completed_sessions AS (
          SELECT DISTINCT session_id FROM analytics_events
          WHERE store_id = ${storeId}
            AND event = 'order_completed'
            AND created_at BETWEEN ${new Date(from)} AND ${new Date(to)}
        )
        SELECT
          (SELECT COUNT(*) FROM checkout_sessions)::int AS total_carts_with_items,
          (SELECT COUNT(*) FROM checkout_sessions
           WHERE session_id NOT IN (SELECT session_id FROM completed_sessions))::int AS abandoned
      `,
    );

    const row = result.rows[0];
    const total = Number(row.total_carts_with_items);
    const abandoned = Number(row.abandoned);

    return {
      totalCartsWithItems: total,
      abandoned,
      abandonedRate: total === 0 ? 0 : abandoned / total,
    };
  }
}
