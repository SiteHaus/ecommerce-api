import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { EasypostWebhookController } from "./easypost-webhook.controller";

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
    ]),
  ],
  controllers: [EasypostWebhookController],
})
export class EasypostWebhookModule {}
