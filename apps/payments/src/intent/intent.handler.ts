import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { IntentService } from "./intent.service";

@Controller()
export class IntentHandler {
  constructor(private readonly intent: IntentService) {}

  @MessagePattern("stripe.intent.create")
  createIntent(
    @Payload()
    payload: {
      orderId: string;
      cartId?: string;
      successUrl: string;
      cancelUrl: string;
      stripeCouponId?: string | null;
      shipping?: {
        name?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
      };
    },
  ) {
    return this.intent.createIntent(
      payload.orderId,
      payload.successUrl,
      payload.cancelUrl,
      payload.cartId,
      payload.stripeCouponId ?? null,
      payload.shipping,
    );
  }
}
