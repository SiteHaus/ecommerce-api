import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { IntentService } from "./intent.service";

@Controller()
export class IntentHandler {
  constructor(private readonly intent: IntentService) {}

  @MessagePattern("stripe.intent.create")
  createIntent(
    @Payload() payload: { orderId: string; cartId?: string; successUrl: string; cancelUrl: string },
  ) {
    return this.intent.createIntent(
      payload.orderId,
      payload.successUrl,
      payload.cancelUrl,
      payload.cartId,
    );
  }
}
