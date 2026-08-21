import { Module } from "@nestjs/common";
import { EasypostService } from "./easypost.service";

@Module({
  providers: [EasypostService],
  exports: [EasypostService],
})
export class EasypostModule {}
