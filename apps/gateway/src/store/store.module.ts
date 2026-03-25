import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { DbModule } from "@sitehaus-ecom/shared";
import IORedis from "ioredis";
import { AnonSessionMiddleware } from "../anon-session/anon-session.middleware";
import { AnonSessionModule } from "../anon-session/anon-session.module";
import { StoreAdminController } from "./store-admin.controller";
import { StoreResolutionMiddleware } from "./store-resolution.middleware";
import { REDIS_TOKEN, StoreService } from "./store.service";

@Module({
  imports: [
    DbModule,
    ConfigModule,
    AnonSessionModule,
    ClientsModule.registerAsync([
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
  ],
  controllers: [StoreAdminController],
  providers: [
    StoreService,
    {
      provide: REDIS_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new IORedis(config.getOrThrow("REDIS_URL")),
    },
  ],
  exports: [StoreService],
})
export class StoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AnonSessionMiddleware).forRoutes("*");
    consumer
      .apply(StoreResolutionMiddleware)
      // POST /v1/admin/stores creates a new store — no store to resolve yet
      .exclude({ path: "v1/admin/stores", method: RequestMethod.POST })
      .forRoutes("*");
  }
}
