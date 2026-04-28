import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { DbModule, EmailModule, AuditModule } from "@sitehaus-ecom/shared";
import { validateWorkerEnv } from "./config/env";
import { ReservationExpireProcessor } from "./processors/reservation-expire.processor";
import { CartExpireProcessor } from "./processors/cart-expire.processor";
import { NotificationsProcessor } from "./processors/order-confirmed.processor";
import { PublishScheduledProcessor } from "./processors/publish-scheduled.processor";
import { ReturnRefundProcessor } from "./processors/return-refund.processor";

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
      { name: "ecom-inventory" },
      { name: "ecom-orders" },
      { name: "ecom-notifications" },
      { name: "ecom-catalog" },
      { name: "ecom-returns" },
    ),
  ],
  providers: [
    ReservationExpireProcessor,
    CartExpireProcessor,
    NotificationsProcessor,
    PublishScheduledProcessor,
    ReturnRefundProcessor,
  ],
})
export class AppModule {}
