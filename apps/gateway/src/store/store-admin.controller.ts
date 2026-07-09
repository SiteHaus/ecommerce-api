import { Controller, ForbiddenException, Inject, Req, UseGuards } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { AdminStoreGuard } from "./admin-store.guard";
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

  @TsRestHandler(contract.store.getAccessible)
  async getAccessible(@Req() req: Request) {
    return tsRestHandler(contract.store.getAccessible, async ({ query }) => {
      const requested = query.clientIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      // Only first-party operators may resolve stores for arbitrary clientIds.
      // Merchant tokens are scoped to their own client so they cannot enumerate
      // other tenants' stores by supplying foreign clientIds.
      const clientIds = req.user!.clientIsFirstParty
        ? requested
        : requested.filter((id) => id === req.user!.clientId);

      const stores = await this.storeService.findByClientIds(clientIds);
      return { status: 200 as const, body: { stores } };
    });
  }

  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.store.getMe)
  async getMe(@Req() req: Request) {
    return tsRestHandler(contract.store.getMe, async () => {
      return { status: 200 as const, body: req.store! };
    });
  }

  @TsRestHandler(contract.store.createStore)
  async create(@Req() req: Request) {
    return tsRestHandler(contract.store.createStore, async ({ body }) => {
      const requestedClientId = req.headers["x-client-id"] as string | undefined;

      // Mirror AdminStoreGuard's binding rule: a merchant token may only create
      // a store for its own client. Only first-party operators may pass a
      // foreign x-client-id to provision on a merchant's behalf.
      if (
        requestedClientId &&
        requestedClientId !== req.user!.clientId &&
        !req.user!.clientIsFirstParty
      ) {
        throw new ForbiddenException("You do not have access to this store");
      }

      const clientId = requestedClientId ?? req.user!.clientId;
      try {
        const store = await this.storeService.create(clientId, body);
        return { status: 201 as const, body: store };
      } catch (err: any) {
        return this.handleStoreConflict(err);
      }
    });
  }

  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.store.updateStore)
  async update(@Req() req: Request) {
    return tsRestHandler(contract.store.updateStore, async ({ body }) => {
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

  @UseGuards(AdminStoreGuard)
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

  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.store.stripeStatus)
  async stripeStatus(@Req() req: Request) {
    return tsRestHandler(contract.store.stripeStatus, async () => {
      const store = req.store!;

      if (!store.stripeAccountId) {
        return {
          status: 200 as const,
          body: {
            connected: false,
            chargesEnabled: false,
            payoutsEnabled: false,
            detailsSubmitted: false,
          },
        };
      }

      // Sync live from Stripe whenever onboarding is still incomplete.
      // The old check required ALL flags to be false, so a partially-onboarded
      // account (charges enabled, payouts/details not yet) was never re-synced.
      const needsSync =
        !store.stripeChargesEnabled || !store.stripePayoutsEnabled || !store.stripeDetailsSubmitted;
      const flags = needsSync
        ? await firstValueFrom(
            this.paymentsClient.send<{
              chargesEnabled: boolean;
              payoutsEnabled: boolean;
              detailsSubmitted: boolean;
            }>("stripe.account.sync", { storeId: store.id, accountId: store.stripeAccountId }),
          )
        : {
            chargesEnabled: store.stripeChargesEnabled,
            payoutsEnabled: store.stripePayoutsEnabled,
            detailsSubmitted: store.stripeDetailsSubmitted,
          };

      return {
        status: 200 as const,
        body: { connected: true, ...flags },
      };
    });
  }
}
