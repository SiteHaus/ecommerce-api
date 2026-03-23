import { Controller, Inject, Req, UseGuards } from "@nestjs/common";
import { StoreOwnerGuard } from "@sitehaus-ecom/auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@sitehaus-ecom/contracts";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";
import { ClientProxy } from "@nestjs/microservices";

@Controller()
@UseGuards(StoreOwnerGuard)
export class VariantsController {
  constructor(
    @Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy,
  ) {}

  @TsRestHandler(contract.variant.create)
  async create(@Req() req: Request) {
    return tsRestHandler(contract.variant.create, async ({ body, params }) => {
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
}
