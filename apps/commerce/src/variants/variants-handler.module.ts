import { Module } from "@nestjs/common";
import { VariantsHandlerController } from "./variants-handler.controller";
import { VariantsHandlerService } from "./variants-handler.service";
import { VariationsSyncService } from "./variations-sync.service";
import { AuditModule } from "@sitehaus-ecom/shared";

@Module({
  imports: [AuditModule],
  controllers: [VariantsHandlerController],
  providers: [VariantsHandlerService, VariationsSyncService],
})
export class VariantsHandlerModule {}
