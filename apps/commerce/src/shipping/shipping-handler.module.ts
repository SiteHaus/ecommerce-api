import { Module } from "@nestjs/common";
import { ShippingZoneHandlerController } from "./shippingzone-handler.controller";
import { ShippingRatesHandlerController } from "./shippingrate-handler.controller";
import { AuditModule } from "@sitehaus-ecom/shared";
import { ShippingRatesHandlerService } from "./shippingrate-handler.service";
import { ShippingZoneHandlerService } from "./shippingzone-handler.service";

@Module({
  imports: [AuditModule],
  controllers: [ShippingZoneHandlerController, ShippingRatesHandlerController],
  providers: [ShippingRatesHandlerService, ShippingZoneHandlerService],
})
export class ShippingHandlersModule {}
