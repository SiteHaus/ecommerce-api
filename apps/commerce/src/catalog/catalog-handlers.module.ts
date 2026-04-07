import { Module } from "@nestjs/common";
import { ProductsHandlerModule } from "../products/products-handler.module";
import { VariantsHandlerModule } from "../variants/variants-handler.module";
import { ImagesHandlerModule } from "../images/images-handlers.module";
import { CollectionsHandlerModule } from "../collections/collections-handler.module";

@Module({
  imports: [
    ProductsHandlerModule,
    VariantsHandlerModule,
    ImagesHandlerModule,
    CollectionsHandlerModule,
  ],
})
export class CatalogHandlersModule {}
