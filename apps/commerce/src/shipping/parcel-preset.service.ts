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

  /**
   * Returns a message rather than void, matching deleteZone/deleteRate. A
   * handler resolving `undefined` never emits, so the gateway's `firstValueFrom`
   * throws EmptyError and a successful delete surfaces as a failure toast.
   */
  async delete(storeId: string, presetId: string): Promise<{ message: string }> {
    await this.db
      .delete(parcelPresetsTable)
      .where(and(eq(parcelPresetsTable.id, presetId), eq(parcelPresetsTable.storeId, storeId)));
    return { message: "Preset deleted." };
  }
}
