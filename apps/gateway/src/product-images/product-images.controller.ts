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
export class ImagesController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @CommercePerm("products:read")
  @TsRestHandler(contract.image.listImages)
  async list(@Req() req: Request) {
    return tsRestHandler(contract.image.listImages, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.images.list", {
          productId: params.id,
          storeId: req.store!.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @TsRestHandler(contract.image.uploadUrl)
  async uploadUrl(@Req() req: Request) {
    return tsRestHandler(contract.image.uploadUrl, async ({ body, params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.images.uploadUrl", {
          productId: params.id,
          storeId: req.store!.id,
          contentType: body.contentType,
        }),
      );
      return { status: 201 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @TsRestHandler(contract.image.confirmImage)
  async confirm(@Req() req: Request) {
    return tsRestHandler(contract.image.confirmImage, async ({ body, params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.images.confirm", {
          productId: params.id,
          storeId: req.store!.id,
          ...body,
        }),
      );
      return { status: 201 as const, body: result };
    });
  }

  @CommercePerm("products:delete")
  @TsRestHandler(contract.image.deleteImage)
  async delete(@Req() req: Request) {
    return tsRestHandler(contract.image.deleteImage, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.images.delete", {
          productId: params.id,
          imageId: params.imageId,
          storeId: req.store!.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @TsRestHandler(contract.image.reorderImages)
  async reorder(@Req() req: Request) {
    return tsRestHandler(contract.image.reorderImages, async ({ body, params }) => {
      const result = await firstValueFrom(
        this.commerce.send("catalog.images.reorder", {
          productId: params.id,
          storeId: req.store!.id,
          items: body.items,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
