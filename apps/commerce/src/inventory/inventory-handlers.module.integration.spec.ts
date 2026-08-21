/**
 * Real NestJS DI boot test for InventoryHandlersModule.
 *
 * Unit tests mock BullMQ's queue token directly (getQueueToken(...)), which bypasses
 * real `imports` wiring entirely — exactly the seam where a provider can request a
 * queue its module never registered, and nothing catches it until a real deploy (see
 * SIT-297: InventoryHandlersModule crashed staging on boot this way). This test
 * assembles the module the way NestJS actually does at boot: a real DbModule (it's
 * @Global(), so production gets it for free from AppModule — a standalone module test
 * does not, and must import it explicitly here) and a real BullMQ connection to a real
 * Redis, since registerQueue's factory needs a live connection to resolve; a fake one
 * would silently pass even with a missing registration.
 *
 * Requires a reachable Postgres + Redis — see docker-compose.dev.yml.
 */
import { Test } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { Pool } from "pg";
import Redis from "ioredis";
import { DbModule } from "@sitehaus-ecom/shared";
import { InventoryHandlersModule } from "./inventory-handlers.module";
import { InventoryHandlerService } from "./inventory-handler.service";
import { ReservationService } from "./reservation.service";

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

describe("InventoryHandlersModule (real DI boot)", () => {
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

  it("resolves every provider through real DI — the exact class of bug that crashed staging (SIT-297)", async () => {
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
        InventoryHandlersModule,
      ],
    }).compile();

    // Proves the whole graph actually wired up, not just that compile() didn't throw —
    // resolve the real services the module exists to provide.
    expect(moduleRef.get(InventoryHandlerService)).toBeDefined();
    expect(moduleRef.get(ReservationService)).toBeDefined();

    await moduleRef.close();
  }, 30_000);
});
