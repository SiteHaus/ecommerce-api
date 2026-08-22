import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ConfigModule, ConfigService } from "@nestjs/config";
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
  imports: [
    AuditModule,
    EasypostModule,
    // `ClientsModule.registerAsync([...])` (the array form) is NOT global — it
    // exports its clients to the importing module only. AppModule registering
    // PAYMENTS_SERVICE therefore does nothing for us, so LabelPurchaseService's
    // @Inject("PAYMENTS_SERVICE") has to be satisfied by a registration right
    // here. Same shape as apps/gateway/src/shipping/shipping.module.ts.
    ClientsModule.registerAsync([
      {
        name: "PAYMENTS_SERVICE",
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get("PAYMENTS_HOST", "localhost"),
            port: 7022,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
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
