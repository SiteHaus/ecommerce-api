import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { DbModule, EmailModule, AuditModule } from "@sitehaus-ecom/shared";
import { validateWorkerEnv } from "./config/env";
import { ReservationExpireProcessor } from "./processors/reservation-expire.processor";
import { CartExpireProcessor } from "./processors/cart-expire.processor";
import { OrderExpireProcessor } from "./processors/order-expire.processor";
import { NotificationsProcessor } from "./processors/notifications.processor";
import { PublishScheduledProcessor } from "./processors/publish-scheduled.processor";
import { ReturnRefundProcessor } from "./processors/return-refund.processor";
import { WebhookProcessor } from "./processors/webhook.processor";
import { AnalyticsRetentionProcessor } from "./processors/analytics-retention.processor";
import { HeartbeatService } from "./heartbeat/heartbeat.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateWorkerEnv }),

    // Shared infrastructure
    DbModule,
    EmailModule,
    AuditModule,

    // BullMQ — Redis-backed job queues
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow("REDIS_URL") },
      }),
    }),
    BullModule.registerQueue(
      { name: "ecom-analytics" },
      { name: "ecom-inventory" },
      { name: "ecom-orders" },
      { name: "ecom-notifications" },
      { name: "ecom-catalog" },
      { name: "ecom-returns" },
      { name: "ecom-webhooks" },
    ),
  ],
  providers: [
    HeartbeatService,
    AnalyticsRetentionProcessor,
    ReservationExpireProcessor,
    CartExpireProcessor,
    OrderExpireProcessor,
    NotificationsProcessor,
    PublishScheduledProcessor,
    ReturnRefundProcessor,
    WebhookProcessor,
  ],
})
export class AppModule {}
