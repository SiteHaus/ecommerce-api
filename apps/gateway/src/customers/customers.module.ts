import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CustomersController } from "./customers.controller";
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
          options: { host: config.get("COMMERCE_HOST", "localhost"), port: 7021 },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [CustomersController],
})
export class CustomersModule {}
