import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { OriginAddress, OriginAddressService } from "./origin-address.service";

@Controller()
export class OriginAddressHandler {
  constructor(private readonly originAddress: OriginAddressService) {}

  @MessagePattern("shipping.getOriginAddress")
  get(@Payload() data: { storeId: string }) {
    return this.originAddress.get(data.storeId);
  }

  @MessagePattern("shipping.setOriginAddress")
  set(@Payload() data: { storeId: string; address: OriginAddress }) {
    return this.originAddress.set(data.storeId, data.address);
  }
}
