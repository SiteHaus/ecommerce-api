import { Module } from "@nestjs/common";
import { AuditModule } from "@sitehaus-ecom/shared";
import { RefundHandler } from "./refund.handler";
import { RefundService } from "./refund.service";

@Module({
  imports: [AuditModule],
  controllers: [RefundHandler],
  providers: [RefundService],
})
export class RefundModule {}
