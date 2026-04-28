import { Controller, Inject, Req, UseGuards } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@sitehaus-ecom/contracts";
import { AdminStoreGuard } from "../store/admin-store.guard";
import { CommercePerm } from "../store/commerce-perm.decorator";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Controller()
export class DiscountsController {
  constructor(
    @Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy,
    @Inject("PAYMENTS_SERVICE") private readonly payments: ClientProxy,
  ) {}

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.discount.listDiscounts)
  listDiscounts(@Req() req: Request) {
    return tsRestHandler(contract.discount.listDiscounts, async ({ query }) => {
      const result = await firstValueFrom(
        this.commerce.send("discounts.list", { ...query, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.discount.getDiscount)
  getDiscount(@Req() req: Request) {
    return tsRestHandler(contract.discount.getDiscount, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("discounts.get", { id: params.id, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.discount.createDiscount)
  createDiscount(@Req() req: Request) {
    return tsRestHandler(contract.discount.createDiscount, async ({ body }) => {
      const store = req.store!;

      // 1. Sync coupon to Stripe on the store's connected account
      const { stripeCouponId } = await firstValueFrom(
        this.payments.send("payments.discounts.createCoupon", {
          storeId: store.id,
          type: body.type,
          value: body.value,
          name: body.name,
          currency: store.currency,
          usageLimitTotal: body.usageLimitTotal,
          endsAt: body.endsAt,
        }),
      );

      // 2. Persist locally (stripeCouponId is "" for free_shipping → stored as null)
      const result = await firstValueFrom(
        this.commerce.send("discounts.create", {
          ...body,
          storeId: store.id,
          stripeCouponId: stripeCouponId || null,
        }),
      );

      return { status: 201 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.discount.updateDiscount)
  updateDiscount(@Req() req: Request) {
    return tsRestHandler(contract.discount.updateDiscount, async ({ params, body }) => {
      const store = req.store!;

      // Sync name change to Stripe if applicable
      if (body.name) {
        const { stripeCouponId } = await firstValueFrom(
          this.commerce.send("discounts.getStripeCouponId", {
            id: params.id,
            storeId: store.id,
          }),
        );
        if (stripeCouponId) {
          await firstValueFrom(
            this.payments.send("payments.discounts.updateCoupon", {
              storeId: store.id,
              stripeCouponId,
              name: body.name,
            }),
          );
        }
      }

      const result = await firstValueFrom(
        this.commerce.send("discounts.update", {
          ...body,
          id: params.id,
          storeId: store.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.discount.deleteDiscount)
  deleteDiscount(@Req() req: Request) {
    return tsRestHandler(contract.discount.deleteDiscount, async ({ params }) => {
      const store = req.store!;

      // Delete Stripe coupon first (non-fatal if it fails)
      const { stripeCouponId } = await firstValueFrom(
        this.commerce.send("discounts.getStripeCouponId", { id: params.id, storeId: store.id }),
      );
      if (stripeCouponId) {
        await firstValueFrom(
          this.payments.send("payments.discounts.deleteCoupon", {
            storeId: store.id,
            stripeCouponId,
          }),
        );
      }

      const result = await firstValueFrom(
        this.commerce.send("discounts.delete", { id: params.id, storeId: store.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.discount.createDiscountCode)
  createDiscountCode(@Req() req: Request) {
    return tsRestHandler(contract.discount.createDiscountCode, async ({ params, body }) => {
      const store = req.store!;

      // Get the Stripe coupon ID for this discount
      const { stripeCouponId } = await firstValueFrom(
        this.commerce.send("discounts.getStripeCouponId", { id: params.id, storeId: store.id }),
      );

      // Sync promo code to Stripe
      const { stripePromotionCodeId } = await firstValueFrom(
        this.payments.send("payments.discounts.createPromoCode", {
          storeId: store.id,
          stripeCouponId,
          code: body.code,
          currency: store.currency,
        }),
      );

      // Persist locally
      const result = await firstValueFrom(
        this.commerce.send("discounts.createCode", {
          discountId: params.id,
          storeId: store.id,
          code: body.code,
          stripePromotionCodeId,
        }),
      );
      return { status: 201 as const, body: result };
    });
  }

  @CommercePerm("products:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.discount.deleteDiscountCode)
  deleteDiscountCode(@Req() req: Request) {
    return tsRestHandler(contract.discount.deleteDiscountCode, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("discounts.deleteCode", {
          codeId: params.codeId,
          storeId: req.store!.id,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
