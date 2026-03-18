import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DbModule, EmailModule, AuditModule } from '@sitehaus-ecom/shared';
import { validateWorkerEnv } from './config/env';
import { ReservationExpireProcessor } from './processors/reservation-expire.processor';
import { CartExpireProcessor } from './processors/cart-expire.processor';
import { OrderConfirmedProcessor } from './processors/order-confirmed.processor';
import { OrderShippedProcessor } from './processors/order-shipped.processor';

// TODO SIT-82: import InventoryModule (ReservationService.expireStale)
// TODO SIT-84: import OrdersModule (CartService.expireStale)

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateWorkerEnv }),

    // Shared infrastructure
    DbModule,
    EmailModule,
    AuditModule,

    // BullMQ — Redis-backed job queues
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow('REDIS_URL') },
      }),
    }),
    BullModule.registerQueue(
      { name: 'ecom:inventory' },
      { name: 'ecom:orders' },
      { name: 'ecom:notifications' },
    ),
  ],
  providers: [
    ReservationExpireProcessor,
    CartExpireProcessor,
    OrderConfirmedProcessor,
    OrderShippedProcessor,
  ],
})
export class AppModule {}
