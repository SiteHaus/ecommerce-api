import { Module } from "@nestjs/common";
import { ProductsHandlerModule } from "../products/products-handler.module";
import { VariantsHandlerModule } from "../variants/variants-handler.module";

// TODO SIT-76: wire CollectionsHandlerController (@MessagePattern catalog.collections.*)
// TODO SIT-77: wire ImagesHandlerController (@MessagePattern catalog.images.*)

@Module({
  imports: [ProductsHandlerModule, VariantsHandlerModule],
})
export class CatalogHandlersModule {}
