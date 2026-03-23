import { Controller, UseGuards, Inject, Req } from "@nestjs/common";
import { StoreOwnerGuard } from "@sitehaus-ecom/auth";
import { ClientProxy } from "@nestjs/microservices";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@sitehaus-ecom/contracts";
import { firstValueFrom } from "rxjs";

@Controller()
export class ProductsController {
  constructor(
    @Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy,
  ) {}

  @UseGuards(StoreOwnerGuard)
  @TsRestHandler(contract.product.create)
  async create(@Req() req: any) {
    return tsRestHandler(contract.product.create, async ({ body }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.create", {
          storeId: req.store.id,
          ...body,
        }),
      );
      return { status: 201 as const, body: result };
    });
  }

  @UseGuards(StoreOwnerGuard)
  @TsRestHandler(contract.product.update)
  async update(@Req() req: any) {
    return tsRestHandler(contract.product.update, async ({ body, params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.update", {
          id: params.id,
          storeId: req.store.id,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @UseGuards(StoreOwnerGuard)
  @TsRestHandler(contract.product.delete)
  async delete(@Req() req: any) {
    return tsRestHandler(contract.product.delete, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.archive", {
          storeId: req.store.id,
          id: params.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @UseGuards(StoreOwnerGuard)
  @TsRestHandler(contract.product.list)
  async listProducts(@Req() req: any) {
    return tsRestHandler(contract.product.list, async ({ query }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.list", {
          ...query,
          storeId: req.store.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.product.get)
  async getProduct() {
    return tsRestHandler(contract.product.get, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.get", {
          id: params.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.product.listPublic)
  async listPublic(@Req() req: any) {
    return tsRestHandler(contract.product.listPublic, async ({ query }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.listPublic", {
          ...query,
          storeId: req.store.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
