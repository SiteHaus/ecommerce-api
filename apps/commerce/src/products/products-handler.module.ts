import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AuditModule } from "@sitehaus-ecom/shared";
import { ProductsHandlerController } from "./products-handler.controller";
import { ProductsHandlerService } from "./products-handler.service";

@Module({
  imports: [AuditModule, BullModule.registerQueue({ name: "ecom-webhooks" })],
  controllers: [ProductsHandlerController],
  providers: [ProductsHandlerService],
})
export class ProductsHandlerModule {}
