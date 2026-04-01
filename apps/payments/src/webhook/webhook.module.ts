import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AuditModule } from "@sitehaus-ecom/shared";
import { ReservationService } from "./reservation.service";
import { WebhookHandler } from "./webhook.handler";
import { WebhookService } from "./webhook.service";

@Module({
  imports: [AuditModule, BullModule.registerQueue({ name: "ecom-notifications" })],
  controllers: [WebhookHandler],
  providers: [WebhookService, ReservationService],
})
export class WebhookModule {}
