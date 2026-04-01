import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import { Inject } from "@nestjs/common";
import { Db, shippingZonesTable, shippingRatesTable } from "@sitehaus-ecom/database";
import { eq } from "@sitehaus-ecom/database";
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

    return zones;
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
    const [zone] = await this.db
      .update(shippingZonesTable)
      .set({
        name: data.name,
        countries: data.countries,
        sortOrder: data.sortOrder,
      })
      .where(eq(shippingZonesTable.id, data.zoneId))
      .returning();

    const rates = await this.db.query.shippingRatesTable.findMany({
      where: (p) => eq(p.zoneId, zone.id),
    });

    return {
      ...zone,
      rates,
    };
  }

  async deleteZone(data: { zoneId: string }) {
    const [deleted] = await this.db
      .delete(shippingZonesTable)
      .where(eq(shippingZonesTable.id, data.zoneId))
      .returning();

    if (!deleted) throw new NotFoundException("Zone not found");

    return { message: "The zone was successfully deleted!" };
  }
}
