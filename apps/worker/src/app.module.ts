import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ClientsModule, Transport } from "@nestjs/microservices";
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
import { AddressRedactionProcessor } from "./processors/address-redaction.processor";
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

    // The order emails print the customer's street, which now lives on the Stripe
    // PaymentIntent rather than in our database — so the worker has to be able to ask
    // payments for it. This is the one new coupling the address-minimization spec adds.
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
    AddressRedactionProcessor,
  ],
})
export class AppModule {}
