import { Controller, Headers, Inject, Post, RawBodyRequest, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ClientProxy } from "@nestjs/microservices";
import { contract } from "@sitehaus-ecom/contracts";
import { Public } from "@sitehaus/client-sdk/nestjs";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request, Response } from "express";
import { firstValueFrom } from "rxjs";

@Public()
@Controller()
export class CheckoutController {
  constructor(
    @Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy,
    @Inject("PAYMENTS_SERVICE") private readonly payments: ClientProxy,
  ) {}

  @Throttle({ mutation: { ttl: 60_000, limit: 5 } })
  @TsRestHandler(contract.checkout.createIntent)
  createIntent(@Req() req: Request) {
    return tsRestHandler(contract.checkout.createIntent, async ({ body }) => {
      const storeId = req.store!.id;
      const sessionToken = (req as any).anonSession?.sub as string | undefined;
      const userId = req.user?.userId;

      const order = await firstValueFrom(
        this.commerce.send("checkout.createOrder", {
          storeId,
          sessionToken,
          userId,
          email: body.email,
          shippingName: body.address?.name,
          shippingLine1: body.address?.line1,
          shippingLine2: body.address?.line2,
          shippingCity: body.address?.city,
          shippingState: body.address?.state,
          shippingZip: body.address?.zip,
          shippingCountry: body.address?.country,
          shippingRateId: body.shippingRateId,
        }),
      );

      const automaticDiscount = await firstValueFrom(
        this.commerce.send("discounts.findApplicableAutomatic", {
          storeId,
          subtotalCents: order.subtotalCents,
        }),
      );

      const { checkoutUrl } = await firstValueFrom(
        this.payments.send("stripe.intent.create", {
          orderId: order.orderId,
          cartId: order.cartId,
          successUrl: body.successUrl,
          cancelUrl: body.cancelUrl,
          stripeCouponId: automaticDiscount?.stripeCouponId ?? null,
        }),
      );

      return {
        status: 201 as const,
        body: {
          orderId: order.orderId,
          checkoutUrl,
          subtotalCents: order.subtotalCents,
          shippingCents: order.shippingCents,
          totalCents: order.totalCents,
        },
      };
    });
  }

  @Post("v1/webhooks/stripe")
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers("stripe-signature") signature: string,
  ) {
    const rawBody = req.rawBody?.toString("base64") ?? "";
    this.payments.emit("payments.webhook.stripe", { rawBody, signature });
    res.status(200).json({ received: true });
  }
}
