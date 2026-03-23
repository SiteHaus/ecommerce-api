import { Module } from "@nestjs/common";
import { ProductsController } from "./products-admin.controller";

@Module({
  controllers: [ProductsController],
})
export class ProductsModule {}
