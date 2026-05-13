import { Module } from "@nestjs/common";
import { OptionsHandlerController } from "./options-handler.controller";
import { OptionsHandlerService } from "./options-handler.service";

@Module({
  controllers: [OptionsHandlerController],
  providers: [OptionsHandlerService],
})
export class OptionsHandlerModule {}
