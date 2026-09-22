import { Module } from "@nestjs/common";
import { ProductsHandlerModule } from "../products/products-handler.module";
import { VariantsHandlerModule } from "../variants/variants-handler.module";
import { CollectionsHandlerModule } from "src/collections/collections-handler.module";
import { ImagesHandlerModule } from "src/images/images-handlers.module";

@Module({
  imports: [
    ProductsHandlerModule,
    VariantsHandlerModule,
    CollectionsHandlerModule,
    ImagesHandlerModule,
  ],
})
export class CatalogHandlersModule {}
