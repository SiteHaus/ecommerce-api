import { Module } from '@nestjs/common';

// TODO SIT-85: wire ShippingZonesHandlerController (@MessagePattern shipping.zones.*)
// TODO SIT-86: wire ShippingRatesHandlerController (@MessagePattern shipping.rates.*, shipping.getRates)

@Module({})
export class ShippingHandlersModule {}
