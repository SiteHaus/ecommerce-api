import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import { Inject } from "@nestjs/common";
import { Db, shippingZonesTable, shippingRatesTable } from "@sitehaus-ecom/database";
import { and, eq, inArray } from "@sitehaus-ecom/database";
import { CreateShippingZoneDto, UpdateShippingZoneDto } from "@sitehaus-ecom/validation";

@Injectable()
export class ShippingZoneHandlerService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,

    private readonly audit: AuditService,
  ) {}

  async listZones(data: { storeId: string }) {
    const zones = await this.db.query.shippingZonesTable.findMany({
      where: (p) => eq(p.storeId, data.storeId),
    });

    const zoneIds = zones.map((z) => z.id);
    const rates = zoneIds.length
      ? await this.db.query.shippingRatesTable.findMany({
          where: (p) => inArray(p.zoneId, zoneIds),
        })
      : [];

    return {
      items: zones.map((z) => ({
        ...z,
        rates: rates.filter((r) => r.zoneId === z.id),
      })),
    };
  }

  async createZone(data: CreateShippingZoneDto & { storeId: string }) {
    const [zone] = await this.db
      .insert(shippingZonesTable)
      .values({
        storeId: data.storeId,
        name: data.name,
        countries: data.countries,
        sortOrder: data.sortOrder,
      })
      .returning();

    const rates = await this.db.query.shippingRatesTable.findMany({
      where: (p) => eq(p.zoneId, zone.id),
    });

    return {
      ...zone,
      rates,
    };
  }

  async updateZone(data: UpdateShippingZoneDto & { storeId: string; zoneId: string }) {
    // Scope by storeId: zone ids are UUIDs but must never be usable across
    // tenants — a merchant token may only touch its own store's zones.
    const [zone] = await this.db
      .update(shippingZonesTable)
      .set({
        name: data.name,
        countries: data.countries,
        sortOrder: data.sortOrder,
      })
      .where(
        and(eq(shippingZonesTable.id, data.zoneId), eq(shippingZonesTable.storeId, data.storeId)),
      )
      .returning();

    if (!zone) throw new NotFoundException("Zone not found");

    const rates = await this.db.query.shippingRatesTable.findMany({
      where: (p) => eq(p.zoneId, zone.id),
    });

    return {
      ...zone,
      rates,
    };
  }

  async deleteZone(data: { storeId: string; zoneId: string }) {
    const [deleted] = await this.db
      .delete(shippingZonesTable)
      .where(
        and(eq(shippingZonesTable.id, data.zoneId), eq(shippingZonesTable.storeId, data.storeId)),
      )
      .returning();

    if (!deleted) throw new NotFoundException("Zone not found");

    return { message: "The zone was successfully deleted!" };
  }
}
