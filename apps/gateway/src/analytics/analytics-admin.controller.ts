import { Controller, Inject, Req, UseGuards } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@sitehaus-ecom/contracts";
import { firstValueFrom } from "rxjs";
import type { Request } from "express";
import { AdminStoreGuard } from "../store/admin-store.guard";
import { CommercePerm } from "../store/commerce-perm.decorator";

@Controller()
@UseGuards(AdminStoreGuard)
export class AnalyticsAdminController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @CommercePerm("analytics:read")
  @TsRestHandler(contract.analytics.adminRevenue)
  adminRevenue(@Req() req: Request) {
    return tsRestHandler(contract.analytics.adminRevenue, async ({ query }) => {
      const body = await firstValueFrom(
        this.commerce.send("analytics.revenue", {
          storeId: req.store!.id,
          period: query.period,
          from: query.from,
          to: query.to,
        }),
      );
      return { status: 200 as const, body };
    });
  }

  @CommercePerm("analytics:read")
  @TsRestHandler(contract.analytics.adminTopProducts)
  adminTopProducts(@Req() req: Request) {
    return tsRestHandler(contract.analytics.adminTopProducts, async ({ query }) => {
      const body = await firstValueFrom(
        this.commerce.send("analytics.topProducts", {
          storeId: req.store!.id,
          from: query.from,
          to: query.to,
          limit: query.limit,
        }),
      );
      return { status: 200 as const, body };
    });
  }

  @CommercePerm("analytics:read")
  @TsRestHandler(contract.analytics.adminFunnel)
  adminFunnel(@Req() req: Request) {
    return tsRestHandler(contract.analytics.adminFunnel, async ({ query }) => {
      const body = await firstValueFrom(
        this.commerce.send("analytics.funnel", {
          storeId: req.store!.id,
          from: query.from,
          to: query.to,
        }),
      );
      return { status: 200 as const, body };
    });
  }

  @CommercePerm("analytics:read")
  @TsRestHandler(contract.analytics.adminAbandonedCarts)
  adminAbandonedCarts(@Req() req: Request) {
    return tsRestHandler(contract.analytics.adminAbandonedCarts, async ({ query }) => {
      const body = await firstValueFrom(
        this.commerce.send("analytics.abandonedCarts", {
          storeId: req.store!.id,
          from: query.from,
          to: query.to,
        }),
      );
      return { status: 200 as const, body };
    });
  }

  @CommercePerm("analytics:read")
  @TsRestHandler(contract.analytics.adminAbandonedCartsList)
  adminAbandonedCartsList(@Req() req: Request) {
    return tsRestHandler(contract.analytics.adminAbandonedCartsList, async ({ query }) => {
      const body = await firstValueFrom(
        this.commerce.send("analytics.abandonedCartsList", {
          storeId: req.store!.id,
          from: query.from,
          to: query.to,
          limit: query.limit,
          offset: query.offset,
        }),
      );
      return { status: 200 as const, body };
    });
  }
}
