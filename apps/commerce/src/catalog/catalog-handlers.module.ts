import { Module } from "@nestjs/common";
import { ProductsHandlerModule } from "../products/products-handler.module";
import { VariantsHandlerModule } from "../variants/variants-handler.module";
import { ImagesHandlerModule } from "../images/images-handlers.module";

// TODO SIT-76: wire CollectionsHandlerController (@MessagePattern catalog.collections.*)

@Module({
  imports: [ProductsHandlerModule, VariantsHandlerModule, ImagesHandlerModule],
})
export class CatalogHandlersModule {}
