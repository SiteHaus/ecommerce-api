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
export class WebhooksAdminController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @CommercePerm("webhooks:read")
  @TsRestHandler(contract.webhooks.adminListEndpoints)
  adminListEndpoints(@Req() req: Request) {
    return tsRestHandler(contract.webhooks.adminListEndpoints, async () => {
      const body = await firstValueFrom(
        this.commerce.send("webhooks.list", { storeId: req.store!.id }),
      );
      return { status: 200 as const, body };
    });
  }

  @CommercePerm("webhooks:write")
  @TsRestHandler(contract.webhooks.adminCreateEndpoint)
  adminCreateEndpoint(@Req() req: Request) {
    return tsRestHandler(contract.webhooks.adminCreateEndpoint, async ({ body }) => {
      const result = await firstValueFrom(
        this.commerce.send("webhooks.create", {
          storeId: req.store!.id,
          url: body.url,
          events: body.events,
        }),
      );
      return { status: 201 as const, body: result };
    });
  }

  @CommercePerm("webhooks:write")
  @TsRestHandler(contract.webhooks.adminUpdateEndpoint)
  adminUpdateEndpoint(@Req() req: Request) {
    return tsRestHandler(contract.webhooks.adminUpdateEndpoint, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("webhooks.update", {
          storeId: req.store!.id,
          endpointId: params.endpointId,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("webhooks:write")
  @TsRestHandler(contract.webhooks.adminDeleteEndpoint)
  adminDeleteEndpoint(@Req() req: Request) {
    return tsRestHandler(contract.webhooks.adminDeleteEndpoint, async ({ params }) => {
      await firstValueFrom(
        this.commerce.send("webhooks.delete", {
          storeId: req.store!.id,
          endpointId: params.endpointId,
        }),
      );
      return { status: 204 as const, body: {} };
    });
  }

  @CommercePerm("webhooks:read")
  @TsRestHandler(contract.webhooks.adminListDeliveries)
  adminListDeliveries(@Req() req: Request) {
    return tsRestHandler(contract.webhooks.adminListDeliveries, async ({ params }) => {
      const body = await firstValueFrom(
        this.commerce.send("webhooks.listDeliveries", {
          storeId: req.store!.id,
          endpointId: params.endpointId,
        }),
      );
      return { status: 200 as const, body };
    });
  }
}
