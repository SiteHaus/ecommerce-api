import { Controller, Inject, Req, UnauthorizedException } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { contract } from "@sitehaus-ecom/contracts";
import { Public } from "@sitehaus/client-sdk/nestjs";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Public()
@Controller()
export class OrdersController {
  constructor(
    @Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy,
    @Inject("PAYMENTS_SERVICE") private readonly payments: ClientProxy,
  ) {}

  @TsRestHandler(contract.orders.getOrder)
  getOrder(@Req() req: Request) {
    return tsRestHandler(contract.orders.getOrder, async ({ params, query }) => {
      const body = await firstValueFrom(
        this.commerce.send("orders.getForCustomer", {
          storeId: req.store!.id,
          orderId: params.orderId,
          userId: req.user?.userId,
          email: query.email,
        }),
      );

      // The street isn't in our database for new orders — it's on the Stripe PaymentIntent.
      // A legacy order still has it in its columns, so only overwrite when Stripe actually
      // has something. If payments is unreachable we render the order without a street
      // rather than failing the page.
      let street = { line1: null as string | null, line2: null as string | null };
      try {
        street = await firstValueFrom(
          this.payments.send<{ line1: string | null; line2: string | null }>(
            "stripe.shipping.get",
            { orderId: params.orderId },
          ),
        );
      } catch {
        // fall through — body keeps whatever the columns held
      }

      return {
        status: 200 as const,
        body: {
          ...body,
          shipping: {
            ...body.shipping,
            line1: street.line1 ?? body.shipping.line1,
            line2: street.line2 ?? body.shipping.line2,
          },
        },
      };
    });
  }

  @TsRestHandler(contract.orders.listOrders)
  listOrders(@Req() req: Request) {
    return tsRestHandler(contract.orders.listOrders, async ({ query }) => {
      if (!req.user) throw new UnauthorizedException();
      const body = await firstValueFrom(
        this.commerce.send("orders.listForCustomer", {
          storeId: req.store!.id,
          userId: req.user.userId,
          limit: query.limit,
          offset: query.offset,
        }),
      );

      return { status: 200 as const, body };
    });
  }
}
