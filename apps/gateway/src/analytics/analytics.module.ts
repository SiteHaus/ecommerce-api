import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { StoreModule } from "../store/store.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsAdminController } from "./analytics-admin.controller";

@Module({
  imports: [
    StoreModule,
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
    ]),
  ],
  controllers: [AnalyticsController, AnalyticsAdminController],
})
export class AnalyticsModule {}
