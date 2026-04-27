import { Controller, Inject, Req, UseGuards } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { contract } from "@sitehaus-ecom/contracts";
import { AdminStoreGuard } from "../store/admin-store.guard";
import { CommercePerm } from "../store/commerce-perm.decorator";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Controller()
export class OptionsAdminController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.options.createOption)
  createOption(@Req() req: Request) {
    return tsRestHandler(contract.options.createOption, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.options.create", {
          productId: params.productId,
          storeId: req.store!.id,
          ...body,
        }),
      );
      return { status: 201 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.options.updateOption)
  updateOption(@Req() req: Request) {
    return tsRestHandler(contract.options.updateOption, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.options.update", {
          optionId: params.optionId,
          storeId: req.store!.id,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.options.deleteOption)
  deleteOption(@Req() req: Request) {
    return tsRestHandler(contract.options.deleteOption, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.options.delete", {
          optionId: params.optionId,
          storeId: req.store!.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.options.createOptionValue)
  createOptionValue(@Req() req: Request) {
    return tsRestHandler(contract.options.createOptionValue, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.options.values.create", {
          optionId: params.optionId,
          storeId: req.store!.id,
          ...body,
        }),
      );
      return { status: 201 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.options.updateOptionValue)
  updateOptionValue(@Req() req: Request) {
    return tsRestHandler(contract.options.updateOptionValue, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.options.values.update", {
          valueId: params.valueId,
          storeId: req.store!.id,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.options.deleteOptionValue)
  deleteOptionValue(@Req() req: Request) {
    return tsRestHandler(contract.options.deleteOptionValue, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.options.values.delete", {
          valueId: params.valueId,
          storeId: req.store!.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
