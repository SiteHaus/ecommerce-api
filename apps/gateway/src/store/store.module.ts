import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { DbModule } from '@sitehaus-ecom/shared';
import { StoreService, REDIS_TOKEN } from './store.service';
import { StoreResolutionMiddleware } from './store-resolution.middleware';
import { StoreAdminController } from './store-admin.controller';

@Module({
  imports: [DbModule, ConfigModule],
  controllers: [StoreAdminController],
  providers: [
    StoreService,
    {
      provide: REDIS_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new IORedis(config.getOrThrow('REDIS_URL')),
    },
  ],
  exports: [StoreService],
})
export class StoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(StoreResolutionMiddleware)
      // POST /v1/admin/stores creates a new store — no store to resolve yet
      .exclude({ path: 'v1/admin/stores', method: RequestMethod.POST })
      .forRoutes('*');
  }
}
