import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { CreateShippingZoneDto, UpdateShippingZoneDto } from "@sitehaus-ecom/validation";
import { ShippingZoneHandlerService } from "./shippingzone-handler.service";
@Controller()
export class ShippingZoneHandlerController {
  constructor(private readonly shippingZonesService: ShippingZoneHandlerService) {}

  @MessagePattern("shipping.listZones")
  listZones(@Payload() data: { storeId: string }) {
    return this.shippingZonesService.listZones(data);
  }

  @MessagePattern("shipping.createZone")
  createZone(
    @Payload()
    data: CreateShippingZoneDto & { storeId: string },
  ) {
    return this.shippingZonesService.createZone(data);
  }

  @MessagePattern("shipping.updateZone")
  updateZone(@Payload() data: UpdateShippingZoneDto & { zoneId: string; storeId: string }) {
    return this.shippingZonesService.updateZone(data);
  }

  @MessagePattern("shipping.deleteZone")
  deleteZone(@Payload() data: { storeId: string; zoneId: string }) {
    return this.shippingZonesService.deleteZone(data);
  }
}
