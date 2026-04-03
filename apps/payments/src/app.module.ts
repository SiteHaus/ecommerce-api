import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { DbModule } from "@sitehaus-ecom/shared";
import { validatePaymentsEnv } from "./config/env";
import { ConnectModule } from "./connect/connect.module";
import { IntentModule } from "./intent/intent.module";
import { RefundModule } from "./refund/refund.module";
import { WebhookModule } from "./webhook/webhook.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validatePaymentsEnv }),
    DbModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow("REDIS_URL") },
      }),
    }),
    ConnectModule,
    IntentModule,
    RefundModule,
    WebhookModule,
  ],
})
export class AppModule {}
