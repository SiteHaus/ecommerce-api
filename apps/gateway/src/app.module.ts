import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { SiteHausAuthModule } from "@sitehaus/client-sdk/nestjs";
import { validateEnv } from "./config/env";
import { RpcExceptionFilter } from "./filters/rpc-exception.filter";
import { SmartThrottlerGuard } from "./throttler/smart-throttler.guard";
import { AnonSessionModule } from "./anon-session/anon-session.module";
import { CartModule } from "./cart/cart.module";
import { CheckoutModule } from "./checkout/checkout.module";
import { InventoryModule } from "./inventory/inventory.module";
import { OrdersModule } from "./orders/orders.module";
import { ProductsModule } from "./products/products.module";
import { StoreModule } from "./store/store.module";
import { VariantsModule } from "./variants/variants.module";

// TODO SIT-69: import SharedModule
// TODO SIT-67+: import HTTP controller modules as they are built

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    // IAM auth — AccessGuard + PermissionGuard registered globally
    SiteHausAuthModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        iamUrl: config.getOrThrow("IAM_URL"),
        clientKey: config.getOrThrow("IAM_CLIENT_KEY"),
        cacheTtlMs: 30_000,
      }),
      inject: [ConfigService],
    }),

    // Redis-backed rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          // Defaults — individual routes override via @Throttle()
          { name: "default", ttl: 60_000, limit: 120 },
        ],
        storage: new ThrottlerStorageRedisService(config.getOrThrow("REDIS_URL")),
      }),
      inject: [ConfigService],
    }),

    // Store model, resolution middleware, and admin endpoints (SIT-70)
    StoreModule,

    // TCP connections to internal services
    ClientsModule.registerAsync([
      {
        name: "COMMERCE_SERVICE",
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get("COMMERCE_HOST", "localhost"),
            port: 7021,
          },
        }),
        inject: [ConfigService],
      },
      {
        name: "PAYMENTS_SERVICE",
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get("PAYMENTS_HOST", "localhost"),
            port: 7022,
          },
        }),
        inject: [ConfigService],
      },
    ]),

    AnonSessionModule,

    CartModule,
    CheckoutModule,
    InventoryModule,
    OrdersModule,
    ProductsModule,
    VariantsModule,
  ],
  providers: [
    // Map RpcException from TCP services → HTTP responses
    { provide: APP_FILTER, useClass: RpcExceptionFilter },

    // Redis-backed throttling keyed by userId → sessionToken → IP
    { provide: APP_GUARD, useClass: SmartThrottlerGuard },
  ],
})
export class AppModule {}
