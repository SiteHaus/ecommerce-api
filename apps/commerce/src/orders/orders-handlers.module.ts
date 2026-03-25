import { Module } from "@nestjs/common";
import { AuditModule } from "@sitehaus-ecom/shared";
import { InventoryHandlersModule } from "../inventory/inventory-handlers.module";
import { CheckoutHandler } from "./checkout.handler";
import { CheckoutService } from "./checkout.service";
import { OrdersHandlerController } from "./orders-handler.controller";
import { OrdersHandlerService } from "./orders-handler.service";

@Module({
  imports: [InventoryHandlersModule, AuditModule],
  controllers: [CheckoutHandler, OrdersHandlerController],
  providers: [CheckoutService, OrdersHandlerService],
})
export class OrdersHandlersModule {}
