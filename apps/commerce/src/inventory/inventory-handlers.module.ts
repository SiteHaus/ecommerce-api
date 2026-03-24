import { Module } from "@nestjs/common";
import { InventoryHandlerController } from "./inventory-handler.controller";
import { InventoryHandlerService } from "./inventory-handler.service";
import { ReservationHandler } from "./reservation.handler";
import { ReservationService } from "./reservation.service";

@Module({
  controllers: [ReservationHandler, InventoryHandlerController],
  providers: [ReservationService, InventoryHandlerService],
})
export class InventoryHandlersModule {}
