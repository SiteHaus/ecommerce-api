import { Controller, UseGuards, Req, Inject } from "@nestjs/common";
import { AdminStoreGuard } from "../store/admin-store.guard";
import { RequirePerms } from "@sitehaus/client-sdk/nestjs";
import { ClientProxy } from "@nestjs/microservices";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@sitehaus-ecom/contracts";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Controller("shipping-admin")
export class ShippingAdminController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @RequirePerms("orders:read")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.shipping.listZones)
  async getZones(@Req() req: Request) {
    return tsRestHandler(contract.shipping.listZones, async () => {
      const result = await firstValueFrom(
        this.commerce.send("shipping.listZones", { storeId: req.store!.id }),
      );

      return { status: 200 as const, body: result };
    });
  }

  @RequirePerms("orders:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.shipping.createZone)
  async createZone(@Req() req: Request) {
    return tsRestHandler(contract.shipping.createZone, async () => {
      const result = await firstValueFrom(
        this.commerce.send("shipping.createZone", { storeId: req.store!.id }),
      );

      return { status: 200 as const, body: result };
    });
  }

  @RequirePerms("orders:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.shipping.updateZone)
  async updateZone(@Req() req: Request) {
    return tsRestHandler(contract.shipping.updateZone, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("shipping.updateZone", {
          storeId: req.store!.id,
          zoneId: params.zoneId,
          data: body,
        }),
      );

      return { status: 200 as const, body: result };
    });
  }

  @RequirePerms("orders:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.shipping.deleteZone)
  async deleteZone(@Req() req: Request) {
    return tsRestHandler(contract.shipping.deleteZone, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("shipping.deleteZone", {
          storeId: req.store!.id,
          zoneId: params.zoneId,
        }),
      );

      return { status: 200 as const, body: result };
    });
  }

  @RequirePerms("orders:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.shipping.createRate)
  async createRate(@Req() req: Request) {
    return tsRestHandler(contract.shipping.createRate, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("shipping.createRate", {
          storeId: req.store!.id,
          zoneId: params.zoneId,
          data: body,
        }),
      );

      return { status: 200 as const, body: result };
    });
  }

  @RequirePerms("orders:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.shipping.updateRate)
  async updateRate(@Req() req: Request) {
    return tsRestHandler(contract.shipping.updateRate, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("shipping.updateRate", {
          storeId: req.store!.id,
          zoneId: params.zoneId,
          rateId: params.rateId,
          data: body,
        }),
      );

      return { status: 200 as const, body: result };
    });
  }

  @RequirePerms("orders:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.shipping.deleteRate)
  async deleteRate(@Req() req: Request) {
    return tsRestHandler(contract.shipping.deleteRate, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("shipping.deleteRate", {
          storeId: req.store!.id,
          zoneId: params.zoneId,
          rateId: params.rateId,
        }),
      );

      return { status: 200 as const, body: result };
    });
  }

  @RequirePerms("orders:read")
  @UseGuards(AdminStoreGuard)
  async getRates(@Req() req: Request) {
    return tsRestHandler(contract.shipping.getRates, async ({ query }) => {
      const result = await firstValueFrom(
        this.commerce.send("shipping.getRates", {
          country: query.country,
          subtotal: query.subtotal,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
