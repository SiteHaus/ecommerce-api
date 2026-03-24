import { Controller, Inject, Req, UseGuards } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { StoreOwnerGuard } from "@sitehaus-ecom/auth";
import { contract } from "@sitehaus-ecom/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";
import { StoreService } from "./store.service";

@Controller()
export class StoreAdminController {
  constructor(
    private readonly storeService: StoreService,
    @Inject("PAYMENTS_SERVICE") private readonly paymentsClient: ClientProxy,
  ) {}

  @TsRestHandler(contract.store.getMe)
  async getMe(@Req() req: Request) {
    return tsRestHandler(contract.store.getMe, async () => {
      const store = req.store;
      if (!store) return { status: 404 as const, body: { message: "Store not found" } };
      return { status: 200 as const, body: store };
    });
  }

  @TsRestHandler(contract.store.create)
  async create(@Req() req: Request) {
    return tsRestHandler(contract.store.create, async ({ body }) => {
      try {
        const store = await this.storeService.create(req.user!.clientId, body);
        return { status: 201 as const, body: store };
      } catch (err: any) {
        return this.handleStoreConflict(err);
      }
    });
  }

  @UseGuards(StoreOwnerGuard)
  @TsRestHandler(contract.store.update)
  async update(@Req() req: Request) {
    return tsRestHandler(contract.store.update, async ({ body }) => {
      const store = req.store!;
      try {
        const result = await this.storeService.update(store.id, store.slug, store.domain, body);
        return { status: 200 as const, body: result };
      } catch (err: any) {
        return this.handleStoreConflict(err);
      }
    });
  }

  private handleStoreConflict(err: any) {
    if (err?.code !== "23505") throw err;
    return {
      status: 409 as const,
      body: {
        message:
          err.constraint === "stores_slug_uq" ? "Slug already taken" : "Domain already taken",
      },
    };
  }

  @UseGuards(StoreOwnerGuard)
  @TsRestHandler(contract.store.connectStripe)
  async connectStripe(@Req() req: Request) {
    return tsRestHandler(contract.store.connectStripe, async ({ body }) => {
      const store = req.store!;
      const result = await firstValueFrom(
        this.paymentsClient.send<{ url: string }>("stripe.connect.initiate", {
          storeId: store.id,
          stripeAccountId: store.stripeAccountId,
          returnUrl: body.returnUrl,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @UseGuards(StoreOwnerGuard)
  @TsRestHandler(contract.store.stripeStatus)
  async stripeStatus(@Req() req: Request) {
    return tsRestHandler(contract.store.stripeStatus, async () => {
      const store = req.store!;
      return {
        status: 200 as const,
        body: {
          connected: store.stripeAccountId !== null,
          chargesEnabled: store.stripeChargesEnabled,
          payoutsEnabled: store.stripePayoutsEnabled,
          detailsSubmitted: store.stripeDetailsSubmitted,
        },
      };
    });
  }
}
