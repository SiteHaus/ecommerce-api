import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { PostageBillingService } from "./postage-billing.service";

@Controller()
export class PostageBillingHandler {
  constructor(private readonly postageBilling: PostageBillingService) {}

  @MessagePattern("payments.postage.getBillingSetup")
  getBillingSetup(@Payload() data: { storeId: string; returnUrl?: string }) {
    return this.postageBilling.getBillingSetup(data.storeId, data.returnUrl);
  }

  @MessagePattern("payments.postage.charge")
  charge(
    @Payload()
    data: {
      stripeCustomerId: string;
      amountCents: number;
      currency?: string;
      // The exact ledger rows this charge settles — hashed into the Stripe
      // idempotency key so a retried batch can't double-charge.
      ledgerRowIds?: string[];
    },
  ) {
    return this.postageBilling.charge(
      data.stripeCustomerId,
      data.amountCents,
      data.currency,
      data.ledgerRowIds,
    );
  }
}
