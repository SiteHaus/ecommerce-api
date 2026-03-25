import { Module } from "@nestjs/common";
import { CartHandlerController } from "./cart-handler.controller";
import { CartHandlerService } from "./cart-handler.service";

@Module({
  controllers: [CartHandlerController],
  providers: [CartHandlerService],
})
export class CartHandlersModule {}
