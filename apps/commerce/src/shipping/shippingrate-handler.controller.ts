import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import {
  CreateShippingRateDto,
  CreateShippingZoneDto,
  UpdateShippingRateDto,
  UpdateShippingZoneDto,
} from "@sitehaus-ecom/validation";
import { ShippingRatesHandlerService } from "./shippingrate-handler.service";
@Controller()
export class ShippingRatesHandlerController {
  constructor(private readonly shippingRatesService: ShippingRatesHandlerService) {}

  @MessagePattern("shipping.createRate")
  createRate(@Payload() data: CreateShippingRateDto & { storeId: string; zoneId: string }) {
    return this.shippingRatesService.createRate(data);
  }

  @MessagePattern("shipping.updateRate")
  updateRate(
    @Payload() data: UpdateShippingRateDto & { storeId: string; zoneId: string; rateId: string },
  ) {
    return this.shippingRatesService.updateRate(data);
  }

  @MessagePattern("shipping.deleteRate")
  deleteRate(@Payload() data: { storeId: string; zoneId: string; rateId: string }) {
    return this.shippingRatesService.deleteRate(data);
  }
}
