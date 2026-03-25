import { Controller, Inject, Req, UseGuards } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { contract } from "@sitehaus-ecom/contracts";
import { StoreOwnerGuard } from "@sitehaus-ecom/auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Controller()
@UseGuards(StoreOwnerGuard)
export class OrdersAdminController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @TsRestHandler(contract.orders.adminListOrders)
  adminListOrders(@Req() req: Request) {
    return tsRestHandler(contract.orders.adminListOrders, async ({ query }) => {
      const body = await firstValueFrom(
        this.commerce.send("orders.adminList", {
          storeId: req.store!.id,
          status: query.status,
          email: query.email,
          limit: query.limit,
          offset: query.offset,
          sort: query.sort,
        }),
      );
      return { status: 200 as const, body };
    });
  }

  @TsRestHandler(contract.orders.adminGetOrder)
  adminGetOrder(@Req() req: Request) {
    return tsRestHandler(contract.orders.adminGetOrder, async ({ params }) => {
      const body = await firstValueFrom(
        this.commerce.send("orders.adminGet", {
          storeId: req.store!.id,
          orderId: params.orderId,
        }),
      );
      return { status: 200 as const, body };
    });
  }
}
