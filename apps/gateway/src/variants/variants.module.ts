import { Module } from "@nestjs/common";
import { VariantsController } from "./variants-admin.controller";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { StoreModule } from "../store/store.module";

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
  controllers: [VariantsController],
})
export class VariantsModule {}
