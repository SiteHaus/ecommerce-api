import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
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
    ConnectModule,
    IntentModule,
    RefundModule,
    WebhookModule,
  ],
})
export class AppModule {}
