import { Injectable, NotFoundException } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { customersTable, ordersTable, type Db } from "@sitehaus-ecom/database";
import { and, eq, ilike, or, sql } from "@sitehaus-ecom/database";
import type { ListCustomersQuery, UpdateCustomerDto } from "@sitehaus-ecom/validation";

@Injectable()
export class CustomersHandlerService {
  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  async list(data: ListCustomersQuery & { storeId: string }) {
    const conditions = [eq(customersTable.storeId, data.storeId)];

    if (data.search) {
      conditions.push(ilike(customersTable.email, `%${data.search}%`));
    }
    if (data.tag) {
      conditions.push(sql`${customersTable.tags} @> ARRAY[${data.tag}]::text[]`);
    }

    const where = and(...conditions);

    const [[{ total }], customers] = await Promise.all([
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(customersTable)
        .where(where),
      this.db
        .select()
        .from(customersTable)
        .where(where)
        .limit(data.limit)
        .offset(data.offset)
        .orderBy(customersTable.createdAt),
    ]);

    const items = await Promise.all(customers.map((c) => this.withStats(c)));
    return { items, total };
  }

  async get(data: { id: string; storeId: string }) {
    const customer = await this.db.query.customersTable.findFirst({
      where: and(eq(customersTable.id, data.id), eq(customersTable.storeId, data.storeId)),
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const orders = await this.getOrdersForCustomer(
      customer.storeId,
      customer.userId,
      customer.email,
    );
    const stats = this.computeStats(orders);

    return {
      ...this.formatCustomer(customer),
      ...stats,
      orders: orders.map(this.formatOrder),
    };
  }

  async update(data: UpdateCustomerDto & { id: string; storeId: string }) {
    const customer = await this.db.query.customersTable.findFirst({
      where: and(eq(customersTable.id, data.id), eq(customersTable.storeId, data.storeId)),
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const [updated] = await this.db
      .update(customersTable)
      .set({
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.tags !== undefined && { tags: data.tags }),
      })
      .where(and(eq(customersTable.id, data.id), eq(customersTable.storeId, data.storeId)))
      .returning();

    const orders = await this.getOrdersForCustomer(updated.storeId, updated.userId, updated.email);
    return { ...this.formatCustomer(updated), ...this.computeStats(orders) };
  }

  async myProfile(data: { storeId: string; userId: string }) {
    const customer = await this.db.query.customersTable.findFirst({
      where: and(eq(customersTable.storeId, data.storeId), eq(customersTable.userId, data.userId)),
    });
    if (!customer) throw new NotFoundException("Customer not found");

    return {
      id: customer.id,
      email: customer.email,
      tags: customer.tags,
      createdAt: customer.createdAt.toISOString(),
    };
  }

  async myOrders(data: { storeId: string; userId: string }) {
    const orders = await this.db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.storeId, data.storeId), eq(ordersTable.userId, data.userId)))
      .orderBy(ordersTable.createdAt);

    return {
      items: orders.map(this.formatOrder),
      total: orders.length,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async withStats(customer: typeof customersTable.$inferSelect) {
    const orders = await this.getOrdersForCustomer(
      customer.storeId,
      customer.userId,
      customer.email,
    );
    return { ...this.formatCustomer(customer), ...this.computeStats(orders) };
  }

  private async getOrdersForCustomer(storeId: string, userId: string | null, email: string) {
    const userFilter = userId
      ? or(eq(ordersTable.userId, userId), eq(ordersTable.email, email))
      : eq(ordersTable.email, email);

    return this.db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.storeId, storeId), userFilter!))
      .orderBy(ordersTable.createdAt);
  }

  private computeStats(orders: (typeof ordersTable.$inferSelect)[]) {
    const confirmed = orders.filter((o) => o.status === "confirmed");
    const ltvCents = confirmed.reduce((sum, o) => sum + o.totalCents, 0);
    const lastOrder = confirmed.at(-1);
    return {
      orderCount: confirmed.length,
      ltvCents,
      lastOrderAt: lastOrder?.confirmedAt?.toISOString() ?? null,
    };
  }

  private formatCustomer(c: typeof customersTable.$inferSelect) {
    return {
      id: c.id,
      userId: c.userId,
      email: c.email,
      notes: c.notes,
      tags: c.tags,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  private formatOrder(o: typeof ordersTable.$inferSelect) {
    return {
      id: o.id,
      status: o.status,
      subtotalCents: o.subtotalCents,
      totalCents: o.totalCents,
      currency: o.currency,
      trackingNumber: o.trackingNumber,
      createdAt: o.createdAt.toISOString(),
      confirmedAt: o.confirmedAt?.toISOString() ?? null,
    };
  }
}
