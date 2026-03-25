import { Controller, Inject, Req } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { contract } from "@sitehaus-ecom/contracts";
import { Public } from "@sitehaus/client-sdk/nestjs";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Public()
@Controller()
export class CartController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  private identity(req: Request) {
    const sessionToken = (req as any).anonSession?.sub as string | undefined;
    const userId = req.user?.userId;
    return { storeId: req.store!.id, sessionToken, userId };
  }

  private async mergeIfNeeded(req: Request) {
    const sessionToken = (req as any).anonSession?.sub as string | undefined;
    const userId = req.user?.userId;
    if (sessionToken && userId) {
      await firstValueFrom(
        this.commerce.send("cart.merge", {
          storeId: req.store!.id,
          sessionToken,
          userId,
        }),
      ).catch(() => {
        // merge is best-effort — never block the main request
      });
    }
  }

  @TsRestHandler(contract.cart.getCart)
  get(@Req() req: Request) {
    return tsRestHandler(contract.cart.getCart, async () => {
      await this.mergeIfNeeded(req);
      const result = await firstValueFrom(this.commerce.send("cart.get", this.identity(req)));
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.cart.addItem)
  addItem(@Req() req: Request) {
    return tsRestHandler(contract.cart.addItem, async ({ body }) => {
      await this.mergeIfNeeded(req);
      const result = await firstValueFrom(
        this.commerce.send("cart.addItem", { ...this.identity(req), ...body }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.cart.updateItem)
  updateItem(@Req() req: Request) {
    return tsRestHandler(contract.cart.updateItem, async ({ params, body }) => {
      await this.mergeIfNeeded(req);
      const result = await firstValueFrom(
        this.commerce.send("cart.updateItem", {
          ...this.identity(req),
          variantId: params.variantId,
          ...body,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.cart.removeItem)
  removeItem(@Req() req: Request) {
    return tsRestHandler(contract.cart.removeItem, async ({ params }) => {
      await this.mergeIfNeeded(req);
      const result = await firstValueFrom(
        this.commerce.send("cart.removeItem", {
          ...this.identity(req),
          variantId: params.variantId,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
