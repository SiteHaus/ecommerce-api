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
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

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

      return { status: 200 as const, body };
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
