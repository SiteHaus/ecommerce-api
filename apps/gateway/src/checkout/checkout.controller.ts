import { Controller, Inject, Req } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { contract } from "@sitehaus-ecom/contracts";
import { Public } from "@sitehaus/client-sdk/nestjs";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Public()
@Controller()
export class CheckoutController {
  constructor(
    @Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy,
    @Inject("PAYMENTS_SERVICE") private readonly payments: ClientProxy,
  ) {}

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
          shippingName: body.address.name,
          shippingLine1: body.address.line1,
          shippingLine2: body.address.line2,
          shippingCity: body.address.city,
          shippingState: body.address.state,
          shippingZip: body.address.zip,
          shippingCountry: body.address.country,
        }),
      );

      const { checkoutUrl } = await firstValueFrom(
        this.payments.send("stripe.intent.create", {
          orderId: order.orderId,
          successUrl: body.successUrl,
          cancelUrl: body.cancelUrl,
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
}
