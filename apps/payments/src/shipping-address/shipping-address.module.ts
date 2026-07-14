import { Module } from "@nestjs/common";
import { ShippingAddressHandler } from "./shipping-address.handler";
import { ShippingAddressService } from "./shipping-address.service";

@Module({
  controllers: [ShippingAddressHandler],
  providers: [ShippingAddressService],
})
export class ShippingAddressModule {}
