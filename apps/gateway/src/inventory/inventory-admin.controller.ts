import { Controller, Inject, Req, UseGuards } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { AdminStoreGuard } from "../store/admin-store.guard";
import { RequirePerms } from "@sitehaus/client-sdk/nestjs";
import { contract } from "@sitehaus-ecom/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Controller()
@UseGuards(AdminStoreGuard)
export class InventoryAdminController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @RequirePerms("products:read")
  @TsRestHandler(contract.inventory.getInventory)
  get(@Req() req: Request) {
    return tsRestHandler(contract.inventory.getInventory, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("inventory.get", {
          variantId: params.variantId,
          storeId: req.store!.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @RequirePerms("products:write")
  @TsRestHandler(contract.inventory.adjust)
  adjust(@Req() req: Request) {
    return tsRestHandler(contract.inventory.adjust, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("inventory.adjust", {
          variantId: params.variantId,
          storeId: req.store!.id,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
