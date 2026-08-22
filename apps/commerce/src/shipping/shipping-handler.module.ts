import { Module } from "@nestjs/common";
import { ShippingZoneHandlerController } from "./shippingzone-handler.controller";
import { ShippingRatesHandlerController } from "./shippingrate-handler.controller";
import { AuditModule } from "@sitehaus-ecom/shared";
import { ShippingRatesHandlerService } from "./shippingrate-handler.service";
import { ShippingZoneHandlerService } from "./shippingzone-handler.service";
import { EasypostModule } from "./easypost.module";
import { OriginAddressHandler } from "./origin-address.handler";
import { OriginAddressService } from "./origin-address.service";
import { ParcelPresetHandler } from "./parcel-preset.handler";
import { ParcelPresetService } from "./parcel-preset.service";
import { LabelPurchaseHandler } from "./label-purchase.handler";
import { LabelPurchaseService } from "./label-purchase.service";
import { PostageLedgerHandler } from "./postage-ledger.handler";
import { PostageLedgerService } from "./postage-ledger.service";
import { EasypostTrackingHandler } from "./easypost-tracking.handler";
import { EasypostTrackingService } from "./easypost-tracking.service";

@Module({
  imports: [AuditModule, EasypostModule],
  controllers: [
    ShippingZoneHandlerController,
    ShippingRatesHandlerController,
    OriginAddressHandler,
    ParcelPresetHandler,
    LabelPurchaseHandler,
    PostageLedgerHandler,
    EasypostTrackingHandler,
  ],
  providers: [
    ShippingRatesHandlerService,
    ShippingZoneHandlerService,
    OriginAddressService,
    ParcelPresetService,
    LabelPurchaseService,
    PostageLedgerService,
    EasypostTrackingService,
  ],
})
export class ShippingHandlersModule {}
