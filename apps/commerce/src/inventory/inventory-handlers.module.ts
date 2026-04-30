import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AuditModule } from "@sitehaus-ecom/shared";
import { InventoryHandlerController } from "./inventory-handler.controller";
import { InventoryHandlerService } from "./inventory-handler.service";
import { ReservationHandler } from "./reservation.handler";
import { ReservationService } from "./reservation.service";

@Module({
  imports: [AuditModule, BullModule.registerQueue({ name: "ecom-webhooks" })],
  controllers: [ReservationHandler, InventoryHandlerController],
  providers: [ReservationService, InventoryHandlerService],
  exports: [ReservationService],
})
export class InventoryHandlersModule {}
