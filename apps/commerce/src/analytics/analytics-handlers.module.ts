import { Module } from "@nestjs/common";
import { AnalyticsHandlerController } from "./analytics-handler.controller";
import { AnalyticsHandlerService } from "./analytics-handler.service";

@Module({
  controllers: [AnalyticsHandlerController],
  providers: [AnalyticsHandlerService],
})
export class AnalyticsHandlersModule {}
