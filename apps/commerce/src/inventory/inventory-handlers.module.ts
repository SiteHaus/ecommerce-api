import { Module } from "@nestjs/common";
import { ReservationHandler } from "./reservation.handler";
import { ReservationService } from "./reservation.service";

// TODO SIT-80: wire InventoryHandlerController (@MessagePattern inventory.get, inventory.adjust, inventory.availability)

@Module({
  controllers: [ReservationHandler],
  providers: [ReservationService],
})
export class InventoryHandlersModule {}
