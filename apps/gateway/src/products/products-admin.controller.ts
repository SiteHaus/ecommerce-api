import { Controller, Inject, Req, UseGuards } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { contract } from "@sitehaus-ecom/contracts";
import { AdminStoreGuard } from "../store/admin-store.guard";
import { Public } from "@sitehaus/client-sdk/nestjs";
import { CommercePerm } from "../store/commerce-perm.decorator";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Controller()
export class ProductsController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @CommercePerm("products:read")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.product.listProducts)
  listProducts(@Req() req: Request) {
    return tsRestHandler(contract.product.listProducts, async ({ query }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.list", { ...query, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.product.createProduct)
  create(@Req() req: Request) {
    return tsRestHandler(contract.product.createProduct, async ({ body }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.create", { storeId: req.store!.id, ...body }),
      );
      return { status: 201 as const, body: result };
    });
  }

  @CommercePerm("products:read")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.product.getProduct)
  getProduct(@Req() req: Request) {
    return tsRestHandler(contract.product.getProduct, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.get", { id: params.id, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.product.updateProduct)
  update(@Req() req: Request) {
    return tsRestHandler(contract.product.updateProduct, async ({ body, params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.update", {
          id: params.id,
          storeId: req.store!.id,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:delete")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.product.deleteProduct)
  delete(@Req() req: Request) {
    return tsRestHandler(contract.product.deleteProduct, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.archive", { id: params.id, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @Public()
  @TsRestHandler(contract.product.listPublic)
  listPublic(@Req() req: Request) {
    return tsRestHandler(contract.product.listPublic, async ({ query }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.listPublic", { ...query, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @Public()
  @TsRestHandler(contract.product.getPublicProduct)
  getPublicProduct(@Req() req: Request) {
    return tsRestHandler(contract.product.getPublicProduct, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.getPublic", { id: params.id, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
