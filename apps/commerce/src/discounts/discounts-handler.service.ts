import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import {
  Db,
  discountCodesTable,
  discountsTable,
  orderDiscountsTable,
} from "@sitehaus-ecom/database";
import { and, eq, sql, inArray } from "@sitehaus-ecom/database";
import type { CreateDiscountDto, UpdateDiscountDto } from "@sitehaus-ecom/validation";

@Injectable()
export class DiscountsHandlerService {
  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  private async fetchWithCodes(discountId: string) {
    const [discount, codes] = await Promise.all([
      this.db.query.discountsTable.findFirst({
        where: (d) => eq(d.id, discountId),
      }),
      this.db.query.discountCodesTable.findMany({
        where: (c) => eq(c.discountId, discountId),
      }),
    ]);
    if (!discount) throw new NotFoundException("Discount not found");
    return this.format(discount, codes);
  }

  private format(
    discount: typeof discountsTable.$inferSelect,
    codes: (typeof discountCodesTable.$inferSelect)[],
  ) {
    return {
      id: discount.id,
      name: discount.name,
      type: discount.type,
      value: discount.value ?? null,
      isAutomatic: discount.isAutomatic,
      isActive: discount.isActive,
      applicability: discount.applicability,
      minOrderCents: discount.minOrderCents ?? null,
      usageLimitTotal: discount.usageLimitTotal ?? null,
      usageLimitPerCustomer: discount.usageLimitPerCustomer ?? null,
      startsAt: discount.startsAt?.toISOString() ?? null,
      endsAt: discount.endsAt?.toISOString() ?? null,
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code,
        usageCount: c.usageCount,
        createdAt: c.createdAt.toISOString(),
      })),
      createdAt: discount.createdAt.toISOString(),
      updatedAt: discount.updatedAt.toISOString(),
    };
  }

  async list(data: { storeId: string; limit: number; offset: number }) {
    const where = eq(discountsTable.storeId, data.storeId);

    const [{ count }] = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(discountsTable)
      .where(where);

    const rows = await this.db.query.discountsTable.findMany({
      where,
      limit: data.limit,
      offset: data.offset,
      orderBy: (d, { desc }) => [desc(d.createdAt)],
    });

    if (rows.length === 0) return { items: [], total: Number(count) };

    const allCodes = await this.db.query.discountCodesTable.findMany({
      where: (c) =>
        inArray(
          c.discountId,
          rows.map((r) => r.id),
        ),
    });

    const items = rows.map((d) =>
      this.format(
        d,
        allCodes.filter((c) => c.discountId === d.id),
      ),
    );

    return { items, total: Number(count) };
  }

  async get(data: { id: string; storeId: string }) {
    const discount = await this.db.query.discountsTable.findFirst({
      where: (d) => and(eq(d.id, data.id), eq(d.storeId, data.storeId)),
    });
    if (!discount) throw new NotFoundException("Discount not found");
    const codes = await this.db.query.discountCodesTable.findMany({
      where: (c) => eq(c.discountId, discount.id),
    });
    return this.format(discount, codes);
  }

  async create(data: CreateDiscountDto & { storeId: string; stripeCouponId: string | null }) {
    const [discount] = await this.db
      .insert(discountsTable)
      .values({
        storeId: data.storeId,
        name: data.name,
        type: data.type,
        value: data.value ?? null,
        isAutomatic: data.isAutomatic,
        applicability: data.applicability,
        minOrderCents: data.minOrderCents ?? null,
        usageLimitTotal: data.usageLimitTotal ?? null,
        usageLimitPerCustomer: data.usageLimitPerCustomer ?? null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        stripeCouponId: data.stripeCouponId,
      })
      .returning();

    return this.format(discount, []);
  }

  async update(data: UpdateDiscountDto & { id: string; storeId: string }) {
    const existing = await this.db.query.discountsTable.findFirst({
      where: (d) => and(eq(d.id, data.id), eq(d.storeId, data.storeId)),
    });
    if (!existing) throw new NotFoundException("Discount not found");

    const [updated] = await this.db
      .update(discountsTable)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.minOrderCents !== undefined && { minOrderCents: data.minOrderCents }),
        ...(data.usageLimitTotal !== undefined && { usageLimitTotal: data.usageLimitTotal }),
        ...(data.usageLimitPerCustomer !== undefined && {
          usageLimitPerCustomer: data.usageLimitPerCustomer,
        }),
        ...(data.startsAt !== undefined && {
          startsAt: data.startsAt ? new Date(data.startsAt) : null,
        }),
        ...(data.endsAt !== undefined && {
          endsAt: data.endsAt ? new Date(data.endsAt) : null,
        }),
      })
      .where(and(eq(discountsTable.id, data.id), eq(discountsTable.storeId, data.storeId)))
      .returning();

    return this.fetchWithCodes(updated.id);
  }

  async delete(data: { id: string; storeId: string }) {
    const existing = await this.db.query.discountsTable.findFirst({
      where: (d) => and(eq(d.id, data.id), eq(d.storeId, data.storeId)),
    });
    if (!existing) throw new NotFoundException("Discount not found");

    await this.db
      .delete(discountsTable)
      .where(and(eq(discountsTable.id, data.id), eq(discountsTable.storeId, data.storeId)));

    return { message: "Discount deleted" };
  }

  async getStripeCouponId(data: { id: string; storeId: string }) {
    const discount = await this.db.query.discountsTable.findFirst({
      where: (d) => and(eq(d.id, data.id), eq(d.storeId, data.storeId)),
    });
    if (!discount) throw new NotFoundException("Discount not found");
    return { stripeCouponId: discount.stripeCouponId };
  }

  async createCode(data: {
    discountId: string;
    storeId: string;
    code: string;
    stripePromotionCodeId: string;
  }) {
    const discount = await this.db.query.discountsTable.findFirst({
      where: (d) => and(eq(d.id, data.discountId), eq(d.storeId, data.storeId)),
    });
    if (!discount) throw new NotFoundException("Discount not found");

    const existing = await this.db.query.discountCodesTable.findFirst({
      where: (c) => and(eq(c.discountId, data.discountId), eq(c.code, data.code)),
    });
    if (existing) throw new ConflictException("Code already exists on this discount");

    await this.db.insert(discountCodesTable).values({
      discountId: data.discountId,
      code: data.code,
      stripePromotionCodeId: data.stripePromotionCodeId,
    });

    return this.fetchWithCodes(data.discountId);
  }

  async deleteCode(data: { codeId: string; storeId: string }) {
    // Verify ownership via discount → store join
    const code = await this.db.query.discountCodesTable.findFirst({
      where: (c) => eq(c.id, data.codeId),
    });
    if (!code) throw new NotFoundException("Discount code not found");

    const discount = await this.db.query.discountsTable.findFirst({
      where: (d) => and(eq(d.id, code.discountId), eq(d.storeId, data.storeId)),
    });
    if (!discount) throw new NotFoundException("Discount code not found");

    await this.db.delete(discountCodesTable).where(eq(discountCodesTable.id, data.codeId));

    return { message: "Discount code deleted" };
  }

  // ── Used at checkout ────────────────────────────────────────────────────────

  async findApplicableAutomatic(data: { storeId: string; subtotalCents: number }) {
    const now = new Date();
    const rows = await this.db.query.discountsTable.findMany({
      where: (d) => and(eq(d.storeId, data.storeId), eq(d.isActive, true), eq(d.isAutomatic, true)),
    });

    // Filter in JS: date range + min order
    const applicable = rows.filter((d) => {
      if (d.startsAt && d.startsAt > now) return false;
      if (d.endsAt && d.endsAt < now) return false;
      if (d.minOrderCents && data.subtotalCents < d.minOrderCents) return false;
      return true;
    });

    if (applicable.length === 0) return null;

    // Return the highest-value discount
    const best = applicable.sort((a, b) => {
      const aVal = a.type === "percentage" ? (a.value ?? 0) * 100 : (a.value ?? 0);
      const bVal = b.type === "percentage" ? (b.value ?? 0) * 100 : (b.value ?? 0);
      return bVal - aVal;
    })[0];

    return {
      id: best.id,
      type: best.type,
      value: best.value ?? null,
      stripeCouponId: best.stripeCouponId,
    };
  }

  async snapshotOnOrder(data: {
    orderId: string;
    discountId: string;
    discountCodeId: string | null;
    codeUsed: string | null;
    amountSavedCents: number;
  }) {
    await this.db.insert(orderDiscountsTable).values({
      orderId: data.orderId,
      discountId: data.discountId,
      discountCodeId: data.discountCodeId,
      codeUsed: data.codeUsed,
      amountSavedCents: data.amountSavedCents,
    });

    // Increment code usage counter if a code was used
    if (data.discountCodeId) {
      await this.db
        .update(discountCodesTable)
        .set({ usageCount: sql`${discountCodesTable.usageCount} + 1` })
        .where(eq(discountCodesTable.id, data.discountCodeId));
    }

    return { ok: true };
  }
}
