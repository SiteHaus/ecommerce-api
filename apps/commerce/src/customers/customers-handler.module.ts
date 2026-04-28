import { Module } from "@nestjs/common";
import { DbModule } from "@sitehaus-ecom/shared";
import { CustomersHandlerController } from "./customers-handler.controller";
import { CustomersHandlerService } from "./customers-handler.service";

@Module({
  imports: [DbModule],
  controllers: [CustomersHandlerController],
  providers: [CustomersHandlerService],
})
export class CustomersHandlerModule {}
