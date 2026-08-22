import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  eq,
  parcelPresetsTable,
  type Db,
  type NewParcelPreset,
} from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";

@Injectable()
export class ParcelPresetService {
  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  async list(storeId: string) {
    return this.db.select().from(parcelPresetsTable).where(eq(parcelPresetsTable.storeId, storeId));
  }

  async create(storeId: string, input: Omit<NewParcelPreset, "id" | "storeId" | "createdAt">) {
    const [preset] = await this.db
      .insert(parcelPresetsTable)
      .values({ ...input, storeId })
      .returning();
    return preset;
  }

  async delete(storeId: string, presetId: string): Promise<void> {
    await this.db
      .delete(parcelPresetsTable)
      .where(and(eq(parcelPresetsTable.id, presetId), eq(parcelPresetsTable.storeId, storeId)));
  }
}
