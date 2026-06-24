import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import { Inject } from "@nestjs/common";
import { Db, shippingZonesTable, shippingRatesTable } from "@sitehaus-ecom/database";
import { eq } from "@sitehaus-ecom/database";
import {
  CreateShippingRateDto,
  CreateShippingZoneDto,
  UpdateShippingRateDto,
  UpdateShippingZoneDto,
} from "@sitehaus-ecom/validation";

@Injectable()
export class ShippingRatesHandlerService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,

    private readonly audit: AuditService,
  ) {}

  async createRate(data: CreateShippingRateDto & { storeId: string; zoneId: string }) {
    const [rate] = await this.db
      .insert(shippingRatesTable)
      .values({
        zoneId: data.zoneId,
        name: data.name,
        rateCents: data.rateCents,
        minOrderCents: data.minOrderCents,
        estimatedDays: data.estimatedDays,
      })
      .returning();

    return rate;
  }

  async updateRate(
    data: UpdateShippingRateDto & { storeId: string; zoneId: string; rateId: string },
  ) {
    const [rate] = await this.db
      .update(shippingRatesTable)
      .set({
        name: data.name,
        rateCents: data.rateCents,
        minOrderCents: data.minOrderCents,
        estimatedDays: data.estimatedDays,
      })
      .where(eq(shippingRatesTable.id, data.rateId))
      .returning();

    if (!rate) throw new NotFoundException("Rate not found");

    return rate;
  }

  async deleteRate(data: { storeId: string; zoneId: string; rateId: string }) {
    const [deleted] = await this.db
      .delete(shippingRatesTable)
      .where(eq(shippingRatesTable.id, data.rateId))
      .returning();

    if (!deleted) throw new NotFoundException("Rate not found");

    return { message: "The rate was successfully deleted!" };
  }

  async getRates(data: { storeId: string; country: string; subtotal: number }) {
    const zones = await this.db.query.shippingZonesTable.findMany({
      where: (z) => eq(z.storeId, data.storeId),
      orderBy: (z) => z.sortOrder,
    });

    if (!zones.length) return { items: [] };

    let matchedZone = zones.find((z) => z.countries?.includes(data.country));
    if (!matchedZone) matchedZone = zones.find((z) => z.countries === null);
    if (!matchedZone) return { items: [] };

    const rates = await this.db.query.shippingRatesTable.findMany({
      where: (r) => eq(r.zoneId, matchedZone.id),
    });

    const items = rates
      .map((rate) => ({
        id: rate.id,
        name: rate.name,
        estimatedDays: rate.estimatedDays,
        rateCents:
          rate.minOrderCents !== null && data.subtotal >= rate.minOrderCents ? 0 : rate.rateCents,
      }))
      .sort((a, b) => a.rateCents - b.rateCents);

    return { items };
  }
}
