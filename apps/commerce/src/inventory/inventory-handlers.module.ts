import { Module } from "@nestjs/common";
import { AuditModule } from "@sitehaus-ecom/shared";
import { InventoryHandlerController } from "./inventory-handler.controller";
import { InventoryHandlerService } from "./inventory-handler.service";
import { ReservationHandler } from "./reservation.handler";
import { ReservationService } from "./reservation.service";

@Module({
  imports: [AuditModule],
  controllers: [ReservationHandler, InventoryHandlerController],
  providers: [ReservationService, InventoryHandlerService],
})
export class InventoryHandlersModule {}
