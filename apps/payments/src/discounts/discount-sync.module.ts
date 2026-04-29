import { Module } from "@nestjs/common";
import { DiscountSyncHandler } from "./discount-sync.handler";
import { DiscountSyncService } from "./discount-sync.service";

@Module({
  controllers: [DiscountSyncHandler],
  providers: [DiscountSyncService],
})
export class DiscountSyncModule {}
