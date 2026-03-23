import { Module } from "@nestjs/common";
import { ProductsHandlerModule } from "../products/products-handler.module";
import { VariantsHandlerModule } from "../variants/variants-handler.module";

@Module({
  imports: [ProductsHandlerModule, VariantsHandlerModule],
})
export class CatalogHandlersModule {}
