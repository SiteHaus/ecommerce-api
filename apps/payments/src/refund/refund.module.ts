import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AuditModule } from "@sitehaus-ecom/shared";
import { RefundHandler } from "./refund.handler";
import { RefundService } from "./refund.service";

@Module({
  imports: [AuditModule, BullModule.registerQueue({ name: "ecom-webhooks" })],
  controllers: [RefundHandler],
  providers: [RefundService],
})
export class RefundModule {}
