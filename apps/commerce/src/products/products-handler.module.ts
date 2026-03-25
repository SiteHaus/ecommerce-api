import { Module } from "@nestjs/common";
import { AuditModule } from "@sitehaus-ecom/shared";
import { ProductsHandlerController } from "./products-handler.controller";
import { ProductsHandlerService } from "./products-handler.service";

@Module({
  imports: [AuditModule],
  controllers: [ProductsHandlerController],
  providers: [ProductsHandlerService],
})
export class ProductsHandlerModule {}
