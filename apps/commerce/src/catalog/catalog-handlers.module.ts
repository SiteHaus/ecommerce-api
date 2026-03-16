import { Module } from '@nestjs/common';

// TODO SIT-74: wire ProductsHandlerController (@MessagePattern catalog.products.*)
// TODO SIT-75: wire VariantsHandlerController (@MessagePattern catalog.variants.*)
// TODO SIT-76: wire CollectionsHandlerController (@MessagePattern catalog.collections.*)
// TODO SIT-77: wire ImagesHandlerController (@MessagePattern catalog.images.*)

@Module({})
export class CatalogHandlersModule {}
