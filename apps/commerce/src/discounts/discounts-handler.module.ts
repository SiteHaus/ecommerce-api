import { Module } from "@nestjs/common";
import { DiscountsHandlerController } from "./discounts-handler.controller";
import { DiscountsHandlerService } from "./discounts-handler.service";

@Module({
  controllers: [DiscountsHandlerController],
  providers: [DiscountsHandlerService],
})
export class DiscountsHandlerModule {}
