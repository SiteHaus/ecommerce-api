import { Inject, Injectable } from "@nestjs/common";
import { eq, storesTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";

export interface OriginAddress {
  originName: string | null;
  originLine1: string | null;
  originLine2: string | null;
  originCity: string | null;
  originState: string | null;
  originZip: string | null;
  originCountry: string | null;
}

@Injectable()
export class OriginAddressService {
  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  async get(storeId: string): Promise<OriginAddress> {
    const store = await this.db.query.storesTable.findFirst({
      where: eq(storesTable.id, storeId),
      columns: {
        originName: true,
        originLine1: true,
        originLine2: true,
        originCity: true,
        originState: true,
        originZip: true,
        originCountry: true,
      },
    });
    return (
      store ?? {
        originName: null,
        originLine1: null,
        originLine2: null,
        originCity: null,
        originState: null,
        originZip: null,
        originCountry: null,
      }
    );
  }

  /**
   * Returns the saved address rather than void: a microservice handler that
   * resolves `undefined` never emits a value, so the gateway's `firstValueFrom`
   * throws EmptyError and a successful write is reported to the merchant as a
   * failure. The `setOriginAddress` contract route already declares `200:
   * OriginAddress`, so echoing the saved row back is what it always expected.
   */
  async set(storeId: string, address: OriginAddress): Promise<OriginAddress> {
    await this.db.update(storesTable).set(address).where(eq(storesTable.id, storeId));
    return this.get(storeId);
  }

  hasOrigin(address: OriginAddress): boolean {
    return !!(
      address.originLine1 &&
      address.originCity &&
      address.originState &&
      address.originZip
    );
  }
}
