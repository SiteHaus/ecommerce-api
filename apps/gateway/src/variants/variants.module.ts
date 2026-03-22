import { Module } from "@nestjs/common";
import { VariantsController } from "./variants-admin.controller";

@Module({
  controllers: [VariantsController],
})
export class VariantsModule {}
