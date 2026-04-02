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
  constructor(
    @Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy,
    @Inject("PAYMENTS_SERVICE") private readonly payments: ClientProxy,
  ) {}

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

  @TsRestHandler(contract.orders.adminShipOrder)
  adminShipOrder(@Req() req: Request) {
    return tsRestHandler(contract.orders.adminShipOrder, async ({ params, body }) => {
      try {
        const result = await firstValueFrom(
          this.commerce.send("orders.ship", {
            storeId: req.store!.id,
            orderId: params.orderId,
            trackingNumber: body.trackingNumber,
          }),
        );
        return { status: 200 as const, body: result };
      } catch (err: any) {
        const status = err?.error?.status ?? err?.status ?? 500;
        const message = err?.error?.message ?? err?.message ?? "Internal server error";
        if (status === 404) return { status: 404 as const, body: { message } };
        if (status === 400) return { status: 400 as const, body: { message } };
        throw err;
      }
    });
  }

  @TsRestHandler(contract.orders.adminRefundOrder)
  adminRefundOrder(@Req() req: Request) {
    return tsRestHandler(contract.orders.adminRefundOrder, async ({ params }) => {
      if (!req.store!.stripeAccountId) {
        return { status: 400 as const, body: { message: "Store has no connected Stripe account" } };
      }
      const result = await firstValueFrom(
        this.payments.send("payments.refund", {
          storeId: req.store!.id,
          orderId: params.orderId,
          store: { stripeAccountId: req.store!.stripeAccountId },
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
