import { Module } from "@nestjs/common";
import { WebhooksHandlerController } from "./webhooks-handler.controller";
import { WebhooksHandlerService } from "./webhooks-handler.service";

@Module({
  controllers: [WebhooksHandlerController],
  providers: [WebhooksHandlerService],
})
export class WebhooksHandlersModule {}
