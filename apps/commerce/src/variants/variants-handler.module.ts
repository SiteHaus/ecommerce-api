import { Module } from "@nestjs/common";
import { VariantsHandlerController } from "./variants-handler.controller";
import { VariantsHandlerService } from "./variants-handler.service";
import { AuditModule } from "@sitehaus-ecom/shared";

@Module({
  imports: [AuditModule],
  controllers: [VariantsHandlerController],
  providers: [VariantsHandlerService],
})
export class VariantsHandlerModule {}
