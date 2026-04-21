import { Controller, Inject, Req, UseGuards } from "@nestjs/common";
import { AdminStoreGuard } from "../store/admin-store.guard";
import { CommercePerm } from "../store/commerce-perm.decorator";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@sitehaus-ecom/contracts";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";
import { ClientProxy } from "@nestjs/microservices";

@Controller()
@UseGuards(AdminStoreGuard)
export class VariantsController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @CommercePerm("products:write")
  @TsRestHandler(contract.variant.createVariant)
  async create(@Req() req: Request) {
    return tsRestHandler(contract.variant.createVariant, async ({ body, params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.variants.create", {
          productId: params.productId,
          storeId: req.store!.id,
          ...body,
        }),
      );
      return { status: 201 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @TsRestHandler(contract.variant.updateVariant)
  async update(@Req() req: Request) {
    return tsRestHandler(contract.variant.updateVariant, async ({ body, params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.variants.update", {
          id: params.id,
          storeId: req.store!.id,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:delete")
  @TsRestHandler(contract.variant.deleteVariant)
  async delete(@Req() req: Request) {
    return tsRestHandler(contract.variant.deleteVariant, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.variants.delete", {
          id: params.id,
          storeId: req.store!.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
