import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { WebhookService } from "./webhook.service";

@Controller()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);

  constructor(private readonly webhook: WebhookService) {}

  @EventPattern("payments.webhook.stripe")
  async handleWebhook(@Payload() data: { rawBody: string; signature: string }) {
    const rawBuffer = Buffer.from(data.rawBody, "base64");
    const event = this.webhook.constructEvent(rawBuffer, data.signature);
    if (!event) return;

    try {
      await this.webhook.handle(event);
    } catch (err: any) {
      this.logger.error(`Error handling Stripe event ${event.type}: ${err.message}`, err.stack);
    }
  }
}
