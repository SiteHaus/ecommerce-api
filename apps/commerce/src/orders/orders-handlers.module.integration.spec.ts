/**
 * Real NestJS DI boot test for OrdersHandlersModule.
 *
 * See inventory-handlers.module.integration.spec.ts for the full rationale — this
 * module also registers BullMQ queues and nests InventoryHandlersModule, so a boot
 * failure anywhere in that combined graph (e.g. SIT-297's class of bug) surfaces here
 * too. Requires a reachable Postgres + Redis — see docker-compose.dev.yml.
 */
import { Test } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { Pool } from "pg";
import Redis from "ioredis";
import { DbModule } from "@sitehaus-ecom/shared";
import { OrdersHandlersModule } from "./orders-handlers.module";
import { OrdersHandlerService } from "./orders-handler.service";
import { CheckoutService } from "./checkout.service";

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

describe("OrdersHandlersModule (real DI boot)", () => {
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

  it("resolves every provider through real DI, including the nested InventoryHandlersModule", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ DATABASE_URL, REDIS_URL })],
        }),
        DbModule,
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: { url: config.getOrThrow("REDIS_URL") },
          }),
        }),
        OrdersHandlersModule,
      ],
    }).compile();

    expect(moduleRef.get(OrdersHandlerService)).toBeDefined();
    expect(moduleRef.get(CheckoutService)).toBeDefined();

    await moduleRef.close();
  }, 30_000);
});
