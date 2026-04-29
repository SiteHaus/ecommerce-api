import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { CheckoutService } from "./checkout.service";

@Controller()
export class CheckoutHandler {
  constructor(private readonly checkout: CheckoutService) {}

  @MessagePattern("checkout.createOrder")
  createOrder(
    @Payload()
    payload: {
      storeId: string;
      sessionToken?: string;
      userId?: string;
      email?: string;
      shippingName?: string;
      shippingLine1?: string;
      shippingLine2?: string;
      shippingCity?: string;
      shippingState?: string;
      shippingZip?: string;
      shippingCountry?: string;
      shippingRateId?: string;
    },
  ) {
    return this.checkout.createOrder(payload);
  }
}
