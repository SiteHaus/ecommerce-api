import { Controller, Inject, Req, UseGuards } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { StoreOwnerGuard } from "@sitehaus-ecom/auth";
import { contract } from "@sitehaus-ecom/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Controller()
@UseGuards(StoreOwnerGuard)
export class CollectionsAdminController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @TsRestHandler(contract.collection.createCollection)
  create(@Req() req: Request) {
    return tsRestHandler(contract.collection.createCollection, async ({ body }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.collections.create", {
          storeId: req.store!.id,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.collection.updateCollection)
  update(@Req() req: Request) {
    return tsRestHandler(contract.collection.updateCollection, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.collections.update", {
          collectionId: params.collectionId,
          storeId: req.store!.id,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.collection.deleteCollection)
  delete(@Req() req: Request) {
    return tsRestHandler(contract.collection.deleteCollection, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.collections.delete", {
          collectionId: params.collectionId,
          storeId: req.store!.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.collection.verify)
  verify(@Req() req: Request) {
    return tsRestHandler(contract.collection.verify, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.collections.verify", {
          storeId: req.store!.id,
          collectionId: params.collectionId,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.collection.reorder)
  reorder(@Req() req: Request) {
    return tsRestHandler(contract.collection.reorder, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.collections.reorderProducts", {
          storeId: req.store!.id,
          collectionId: params.collectionId,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
  @TsRestHandler(contract.collection.list)
  list(@Req() req: Request) {
    return tsRestHandler(contract.collection.list, async () => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.collections.list", {
          storeId: req.store!.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
  @TsRestHandler(contract.collection.getCollection)
  getCollection(@Req() req: Request) {
    return tsRestHandler(contract.collection.getCollection, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.collections.getCollection", {
          storeId: req.store!.id,
          slug: params.slug,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
