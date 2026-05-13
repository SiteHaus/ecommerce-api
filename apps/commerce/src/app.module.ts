import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { DbModule, R2Module, EmailModule, AuditModule } from "@sitehaus-ecom/shared";
import { validateCommerceEnv } from "./config/env";
import { CatalogHandlersModule } from "./catalog/catalog-handlers.module";
import { DiscountsHandlerModule } from "./discounts/discounts-handler.module";
import { InventoryHandlersModule } from "./inventory/inventory-handlers.module";
import { CartHandlersModule } from "./cart/cart-handlers.module";
import { OrdersHandlersModule } from "./orders/orders-handlers.module";
import { ShippingHandlersModule } from "./shipping/shipping-handler.module";
import { VariantsHandlerModule } from "./variants/variants-handler.module";
import { VariantsHandlerService } from "./variants/variants-handler.service";
import { VariantsHandlerController } from "./variants/variants-handler.controller";
import { CollectionsHandlerModule } from "./collections/collections-handler.module";
import { OptionsHandlerModule } from "./options/options-handler.module";
import { CustomersHandlerModule } from "./customers/customers-handler.module";
import { ReturnsHandlerModule } from "./returns/returns-handler.module";
import { WebhooksHandlersModule } from "./webhooks/webhooks-handlers.module";
import { AnalyticsHandlersModule } from "./analytics/analytics-handlers.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateCommerceEnv }),

    // Shared infrastructure — global, available to all handler modules
    DbModule,
    R2Module,
    EmailModule,
    AuditModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow("REDIS_URL") },
      }),
    }),

    // TCP message pattern handlers — filled in per-ticket
    CatalogHandlersModule,
    DiscountsHandlerModule,
    InventoryHandlersModule,
    CartHandlersModule,
    OrdersHandlersModule,
    ShippingHandlersModule,
    VariantsHandlerModule,
    CollectionsHandlerModule,
    OptionsHandlerModule,
    CustomersHandlerModule,
    ReturnsHandlerModule,
    WebhooksHandlersModule,
    AnalyticsHandlersModule,
  ],
})
export class AppModule {}
