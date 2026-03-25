import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { CheckoutController } from "./checkout.controller";

@Module({
  imports: [
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
  ],
  controllers: [CheckoutController],
})
export class CheckoutModule {}
