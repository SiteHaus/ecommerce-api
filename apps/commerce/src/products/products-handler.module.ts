import { Module } from "@nestjs/common";
import { ProductsHandlerController } from "./products-handler.controller";
import { ProductsHandlerService } from "./products-handler.service";
import { AuditModule } from "@sitehaus-ecom/shared";

@Module({
  imports: [AuditModule],
  controllers: [ProductsHandlerController],
  providers: [ProductsHandlerService],
})
export class ProductsHandlerModule {}
