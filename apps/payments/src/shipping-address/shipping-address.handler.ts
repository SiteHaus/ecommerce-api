import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ShippingAddressService } from "./shipping-address.service";

@Controller()
export class ShippingAddressHandler {
  constructor(private readonly shippingAddress: ShippingAddressService) {}

  @MessagePattern("stripe.shipping.get")
  getShippingAddress(@Payload() payload: { orderId: string }) {
    return this.shippingAddress.getShippingAddress(payload.orderId);
  }
}
