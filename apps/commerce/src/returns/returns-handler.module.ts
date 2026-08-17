import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AuditModule, DbModule } from "@sitehaus-ecom/shared";
import { ReturnsHandlerController } from "./returns-handler.controller";
import { ReturnsHandlerService } from "./returns-handler.service";

@Module({
  imports: [
    DbModule,
    AuditModule,
    BullModule.registerQueue({ name: "ecom-notifications" }, { name: "ecom-returns" }),
  ],
  controllers: [ReturnsHandlerController],
  providers: [ReturnsHandlerService],
})
export class ReturnsHandlerModule {}
