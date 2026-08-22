import { Controller, Post, Req, Res, Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Public } from "@sitehaus/client-sdk/nestjs";
import type { Request, Response } from "express";

@Public()
@Controller()
export class EasypostWebhookController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @Post("v1/webhooks/easypost")
  webhook(@Req() req: Request, @Res() res: Response) {
    const body = req.body as any;
    const result = body?.result ?? {};
    // Fire-and-forget, same shape as the Stripe webhook route — never block the
    // 200 response on downstream processing.
    //
    // Note: signature verification (a real EasyPost webhook secret check via
    // EASYPOST_WEBHOOK_SECRET/HMAC) is NOT implemented here. It's a real
    // follow-up that needs a webhook secret from the EasyPost dashboard to
    // test against, deliberately left out rather than guessed at or stubbed
    // with fake logic that would look like security when it isn't.
    this.commerce.emit("commerce.easypost.tracking", {
      shipmentId: result.shipment_id ?? null,
      trackingCode: result.tracking_code ?? null,
      status: result.status ?? "unknown",
      rawEvent: body,
    });
    res.status(200).json({ received: true });
  }
}
