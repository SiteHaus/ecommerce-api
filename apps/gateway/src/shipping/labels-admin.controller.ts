import { Controller, UseGuards, Req, Inject } from "@nestjs/common";
import { AdminStoreGuard } from "../store/admin-store.guard";
import { CommercePerm } from "../store/commerce-perm.decorator";
import { ClientProxy } from "@nestjs/microservices";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@sitehaus-ecom/contracts";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Controller()
export class LabelsAdminController {
  constructor(
    @Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy,
    @Inject("PAYMENTS_SERVICE") private readonly payments: ClientProxy,
  ) {}

  @CommercePerm("orders:read")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.labels.getOriginAddress)
  getOriginAddress(@Req() req: Request) {
    return tsRestHandler(contract.labels.getOriginAddress, async () => {
      const result = await firstValueFrom(
        this.commerce.send("shipping.getOriginAddress", { storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("orders:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.labels.setOriginAddress)
  setOriginAddress(@Req() req: Request) {
    return tsRestHandler(contract.labels.setOriginAddress, async ({ body }) => {
      const result = await firstValueFrom(
        this.commerce.send("shipping.setOriginAddress", { storeId: req.store!.id, address: body }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("orders:read")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.labels.listPresets)
  listPresets(@Req() req: Request) {
    return tsRestHandler(contract.labels.listPresets, async () => {
      const items = await firstValueFrom(
        this.commerce.send("shipping.listPresets", { storeId: req.store!.id }),
      );
      return { status: 200 as const, body: { items } };
    });
  }

  @CommercePerm("orders:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.labels.createPreset)
  createPreset(@Req() req: Request) {
    return tsRestHandler(contract.labels.createPreset, async ({ body }) => {
      const result = await firstValueFrom(
        this.commerce.send("shipping.createPreset", { storeId: req.store!.id, ...body }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("orders:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.labels.deletePreset)
  deletePreset(@Req() req: Request) {
    return tsRestHandler(contract.labels.deletePreset, async ({ params }) => {
      await firstValueFrom(
        this.commerce.send("shipping.deletePreset", {
          storeId: req.store!.id,
          presetId: params.presetId,
        }),
      );
      return { status: 200 as const, body: { message: "Preset deleted" } };
    });
  }

  @CommercePerm("orders:read")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.labels.getPostageBalance)
  getPostageBalance(@Req() req: Request) {
    return tsRestHandler(contract.labels.getPostageBalance, async () => {
      const result = await firstValueFrom(
        this.commerce.send("shipping.getPostageBalance", { storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("orders:read")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.labels.listLedger)
  listLedger(@Req() req: Request) {
    return tsRestHandler(contract.labels.listLedger, async () => {
      const items = await firstValueFrom(
        this.commerce.send("shipping.listLedger", { storeId: req.store!.id }),
      );
      return { status: 200 as const, body: { items } };
    });
  }

  // First call in the flow — provisions the EasyPost account and checks
  // billing setup once, then returns every rate. Buying (below) never
  // re-runs onboarding, since it only happens after a merchant has already
  // seen rates, meaning both checks already passed.
  @CommercePerm("orders:read")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.labels.getRates)
  getRates(@Req() req: Request) {
    return tsRestHandler(contract.labels.getRates, async ({ params }) => {
      // §1/§5: first purchase ever for a store provisions the EasyPost child
      // account inline — never a prerequisite settings-page trip.
      await firstValueFrom(
        this.commerce.send("shipping.ensureEasypostAccount", { storeId: req.store!.id }),
      );

      // §2/§6: billing transparency is a first-class requirement — a missing
      // card on file blocks the purchase with a setup URL, not a generic error.
      const billing = await firstValueFrom(
        this.payments.send<{
          stripeCustomerId: string;
          hasDefaultPaymentMethod: boolean;
          setupUrl?: string;
        }>("payments.postage.getBillingSetup", { storeId: req.store!.id }),
      );
      if (!billing?.hasDefaultPaymentMethod) {
        return {
          status: 400 as const,
          body: { error: "billing_setup_required" as const, setupUrl: billing?.setupUrl },
        };
      }

      const result: any = await firstValueFrom(
        this.commerce.send("shipping.getLabelRates", { orderId: params.orderId }),
      );
      if (result && "error" in result) {
        return { status: 400 as const, body: result };
      }
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("orders:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.labels.buyLabel)
  buyLabel(@Req() req: Request) {
    return tsRestHandler(contract.labels.buyLabel, async ({ params, body }) => {
      const result: any = await firstValueFrom(
        this.commerce.send("shipping.buyLabel", {
          orderId: params.orderId,
          shipmentId: body.shipmentId,
          rateId: body.rateId,
        }),
      );
      if (result && "error" in result) {
        return { status: 400 as const, body: result };
      }
      return { status: 200 as const, body: result };
    });
  }
}
