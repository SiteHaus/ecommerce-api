import { Module } from "@nestjs/common";
import { CollectionsHandlerController } from "./collections-handler.controller";
import { CollectionsHandlerService } from "./collections-handler.service";
import { AuditModule } from "@sitehaus-ecom/shared";

@Module({
  imports: [AuditModule],
  controllers: [CollectionsHandlerController],
  providers: [CollectionsHandlerService],
})
export class CollectionsHandlerModule {}
