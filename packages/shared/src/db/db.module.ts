import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { createDb } from "@sitehaus-ecom/database";

export const DB_TOKEN = "DB_TOKEN";

@Global()
@Module({
  providers: [
    {
      provide: DB_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const pool = new Pool({
          connectionString: config.getOrThrow("DATABASE_URL"),
          max: config.get("DB_POOL_SIZE", 10),
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        });
        return createDb(pool);
      },
    },
  ],
  exports: [DB_TOKEN],
})
export class DbModule {}
