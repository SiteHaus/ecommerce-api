/**
 * Real NestJS DI boot test for ShippingHandlersModule.
 *
 * See inventory-handlers.module.integration.spec.ts for the full rationale. This
 * module is the one that most needed the test: LabelPurchaseService injects the
 * PAYMENTS_SERVICE ClientProxy, and `ClientsModule.registerAsync([...])` in
 * AppModule is *not* global — so without a local registration in this module the
 * whole app fails to boot with an unresolved-dependency error. Unit tests never
 * catch that (they hand-build providers); only a real `.compile()` of the module
 * graph does.
 *
 * EASYPOST_API_KEY is loaded as a throwaway value because EasypostService reads it
 * with `getOrThrow` in its constructor — the client is never used here, only
 * constructed.
 *
 * Requires a reachable Postgres + Redis — see docker-compose.dev.yml.
 */
import { Test } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { Pool } from "pg";
import Redis from "ioredis";
import { DbModule } from "@sitehaus-ecom/shared";
import { ShippingHandlersModule } from "./shipping-handler.module";
import { LabelPurchaseService } from "./label-purchase.service";
import { OriginAddressService } from "./origin-address.service";
import { ParcelPresetService } from "./parcel-preset.service";
import { PostageLedgerService } from "./postage-ledger.service";
import { EasypostTrackingService } from "./easypost-tracking.service";

const DATABASE_URL = process.env.BOOT_IT_DB_URL ?? "postgres://ecom:ecom@localhost:5433/postgres";
const REDIS_URL = process.env.BOOT_IT_REDIS_URL ?? "redis://localhost:6380";

async function postgresReachable() {
  const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
  try {
    await pool.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}

async function redisReachable() {
  const redis = new Redis(REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 2000,
    maxRetriesPerRequest: 0,
  });
  try {
    await redis.connect();
    await redis.ping();
    return true;
  } catch {
    return false;
  } finally {
    redis.disconnect();
  }
}

describe("ShippingHandlersModule (real DI boot)", () => {
  beforeAll(async () => {
    const [pgOk, redisOk] = await Promise.all([postgresReachable(), redisReachable()]);
    if (!pgOk) {
      throw new Error(
        `Postgres unreachable at ${DATABASE_URL}. Start it (docker compose -f docker-compose.dev.yml up -d db) or set BOOT_IT_DB_URL.`,
      );
    }
    if (!redisOk) {
      throw new Error(
        `Redis unreachable at ${REDIS_URL}. Start it (docker compose -f docker-compose.dev.yml up -d redis) or set BOOT_IT_REDIS_URL.`,
      );
    }
  }, 30_000);

  it("resolves every provider through real DI", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ DATABASE_URL, REDIS_URL, EASYPOST_API_KEY: "ek_test_boot" })],
        }),
        DbModule,
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: { url: config.getOrThrow("REDIS_URL") },
          }),
        }),
        ShippingHandlersModule,
      ],
    }).compile();

    // LabelPurchaseService is the one with the cross-service ClientProxy
    // dependency — resolving it proves the PAYMENTS_SERVICE registration is
    // visible to this module, not just to AppModule.
    expect(moduleRef.get(LabelPurchaseService)).toBeDefined();
    expect(moduleRef.get(OriginAddressService)).toBeDefined();
    expect(moduleRef.get(ParcelPresetService)).toBeDefined();
    expect(moduleRef.get(PostageLedgerService)).toBeDefined();
    expect(moduleRef.get(EasypostTrackingService)).toBeDefined();

    await moduleRef.close();
  }, 30_000);
});
