import { Module } from "@nestjs/common";
import { IntentHandler } from "./intent.handler";
import { IntentService } from "./intent.service";

@Module({
  controllers: [IntentHandler],
  providers: [IntentService],
})
export class IntentModule {}
