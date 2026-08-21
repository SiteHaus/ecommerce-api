import { Module } from "@nestjs/common";
import { PostageBillingHandler } from "./postage-billing.handler";
import { PostageBillingService } from "./postage-billing.service";

@Module({
  controllers: [PostageBillingHandler],
  providers: [PostageBillingService],
  exports: [PostageBillingService],
})
export class PostageBillingModule {}
