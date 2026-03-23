import { Module } from "@nestjs/common";
import { VariantsHandlerController } from "./variants-handler.controller";
import { VariantsHandlerService } from "./variants-handler.service";

@Module({
  controllers: [VariantsHandlerController],
  providers: [VariantsHandlerService],
})
export class VariantsHandlerModule {}
