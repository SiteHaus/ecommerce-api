import { Module } from "@nestjs/common";
import { ImagesHandlerController } from "./images-handler.controller";
import { ImagesHandlerService } from "./images-handler.service";
import { AuditModule, R2Module } from "@sitehaus-ecom/shared";

@Module({
  imports: [AuditModule, R2Module],
  controllers: [ImagesHandlerController],
  providers: [ImagesHandlerService],
})
export class ImagesHandlerModule {}
