import { Controller, Inject, Req, UseGuards } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@sitehaus-ecom/contracts";
import { Public } from "@sitehaus/client-sdk/nestjs";
import { AdminStoreGuard } from "../store/admin-store.guard";
import { CommercePerm } from "../store/commerce-perm.decorator";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Controller()
export class ReturnsController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  // ── Admin: settings ──────────────────────────────────────────────────────────

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.returns.getReturnSettings)
  getReturnSettings(@Req() req: Request) {
    return tsRestHandler(contract.returns.getReturnSettings, async () => {
      const result = await firstValueFrom(
        this.commerce.send("returns.getSettings", { storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.returns.updateReturnSettings)
  updateReturnSettings(@Req() req: Request) {
    return tsRestHandler(contract.returns.updateReturnSettings, async ({ body }) => {
      const result = await firstValueFrom(
        this.commerce.send("returns.updateSettings", { ...body, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  // ── Admin: manage returns ─────────────────────────────────────────────────────

  @CommercePerm("products:read")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.returns.listReturns)
  listReturns(@Req() req: Request) {
    return tsRestHandler(contract.returns.listReturns, async ({ query }) => {
      const result = await firstValueFrom(
        this.commerce.send("returns.list", { ...query, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:read")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.returns.getReturn)
  getReturn(@Req() req: Request) {
    return tsRestHandler(contract.returns.getReturn, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("returns.get", { id: params.id, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.returns.approveReturn)
  approveReturn(@Req() req: Request) {
    return tsRestHandler(contract.returns.approveReturn, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("returns.approve", { id: params.id, storeId: req.store!.id, ...body }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.returns.rejectReturn)
  rejectReturn(@Req() req: Request) {
    return tsRestHandler(contract.returns.rejectReturn, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("returns.reject", { id: params.id, storeId: req.store!.id, ...body }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.returns.markReceived)
  markReceived(@Req() req: Request) {
    return tsRestHandler(contract.returns.markReceived, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("returns.markReceived", {
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
  @TsRestHandler(contract.returns.deleteReturn)
  deleteReturn(@Req() req: Request) {
    return tsRestHandler(contract.returns.deleteReturn, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("returns.delete", { id: params.id, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  // ── Public: no auth ───────────────────────────────────────────────────────────

  @Public()
  @TsRestHandler(contract.returns.lookupOrder)
  lookupOrder(@Req() req: Request) {
    return tsRestHandler(contract.returns.lookupOrder, async ({ body }) => {
      const result = await firstValueFrom(
        this.commerce.send("returns.lookup", { storeId: req.store!.id, ...body }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @Public()
  @TsRestHandler(contract.returns.createReturn)
  createReturn(@Req() req: Request) {
    return tsRestHandler(contract.returns.createReturn, async ({ body }) => {
      const result = await firstValueFrom(
        this.commerce.send("returns.create", { storeId: req.store!.id, ...body }),
      );
      return { status: 201 as const, body: result };
    });
  }
}
