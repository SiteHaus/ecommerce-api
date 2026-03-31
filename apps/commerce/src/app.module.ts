import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DbModule, R2Module, EmailModule, AuditModule } from "@sitehaus-ecom/shared";
import { validateCommerceEnv } from "./config/env";
import { CatalogHandlersModule } from "./catalog/catalog-handlers.module";
import { InventoryHandlersModule } from "./inventory/inventory-handlers.module";
import { CartHandlersModule } from "./cart/cart-handlers.module";
import { OrdersHandlersModule } from "./orders/orders-handlers.module";
import { ShippingHandlersModule } from "./shipping/shipping-handler.module";
import { VariantsHandlerModule } from "./variants/variants-handler.module";
import { VariantsHandlerService } from "./variants/variants-handler.service";
import { VariantsHandlerController } from "./variants/variants-handler.controller";
import { CollectionsHandlerModule } from "./collections/collections-handler.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateCommerceEnv }),

    // Shared infrastructure — global, available to all handler modules
    DbModule,
    R2Module,
    EmailModule,
    AuditModule,

    // TCP message pattern handlers — filled in per-ticket
    CatalogHandlersModule,
    InventoryHandlersModule,
    CartHandlersModule,
    OrdersHandlersModule,
    ShippingHandlersModule,
    VariantsHandlerModule,
    CollectionsHandlerModule,
  ],
})
export class AppModule {}
