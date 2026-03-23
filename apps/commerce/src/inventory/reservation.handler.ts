import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ReservationService } from "./reservation.service";

@Controller()
export class ReservationHandler {
  constructor(private readonly reservationService: ReservationService) {}

  @MessagePattern("inventory.reserve")
  reserve(
    @Payload()
    payload: {
      variantId: string;
      orderId: string;
      storeId: string;
      quantity: number;
    },
  ) {
    return this.reservationService.reserve(
      payload.variantId,
      payload.orderId,
      payload.storeId,
      payload.quantity,
    );
  }

  @MessagePattern("inventory.releaseByOrder")
  releaseByOrder(@Payload() payload: { orderId: string }) {
    return this.reservationService.releaseByOrder(payload.orderId);
  }

  @MessagePattern("inventory.commit")
  commit(@Payload() payload: { orderId: string }) {
    return this.reservationService.commit(payload.orderId);
  }

  @MessagePattern("inventory.expireStale")
  expireStale() {
    return this.reservationService.expireStale();
  }
}
