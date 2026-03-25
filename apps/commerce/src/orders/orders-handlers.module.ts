import { Module } from "@nestjs/common";
import { AuditModule } from "@sitehaus-ecom/shared";
import { InventoryHandlersModule } from "../inventory/inventory-handlers.module";
import { CheckoutHandler } from "./checkout.handler";
import { CheckoutService } from "./checkout.service";

@Module({
  imports: [InventoryHandlersModule, AuditModule],
  controllers: [CheckoutHandler],
  providers: [CheckoutService],
})
export class OrdersHandlersModule {}
