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
  async create() {
    return tsRestHandler(contract.product.create, async ({ body }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.create", {
          ...body,
        }),
      );
      return { status: 201 as const, body: result };
    });
  }

  @UseGuards(StoreOwnerGuard)
  @TsRestHandler(contract.product.update)
  async update() {
    return tsRestHandler(contract.product.update, async ({ body, params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.update", {
          id: params.id,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @UseGuards(StoreOwnerGuard)
  @TsRestHandler(contract.product.delete)
  async delete() {
    return tsRestHandler(contract.product.delete, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.archive", {
          id: params.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.product.listProducts)
  async listProducts() {
    return tsRestHandler(contract.product.listProducts, async ({ query }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.listPublic", {
          ...query,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.product.getProduct)
  async getProduct() {
    return tsRestHandler(contract.product.getProduct, async ({ query }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.products.listPublic", {
          ...query,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
