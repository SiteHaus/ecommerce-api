import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { eq, storesTable, type Db } from "@sitehaus-ecom/database";
import Stripe from "stripe";

@Injectable()
export class DiscountSyncService {
  private readonly logger = new Logger(DiscountSyncService.name);
  private readonly stripe: Stripe;

  constructor(
    config: ConfigService,
    @Inject(DB_TOKEN) private readonly db: Db,
  ) {
    this.stripe = new Stripe(config.getOrThrow("STRIPE_SECRET_KEY"));
  }

  private async getStripeAccountId(storeId: string): Promise<string> {
    const store = await this.db.query.storesTable.findFirst({
      where: eq(storesTable.id, storeId),
    });
    if (!store?.stripeAccountId) {
      throw new RpcException({ status: 400, message: "Store has no connected Stripe account" });
    }
    return store.stripeAccountId;
  }

  async createCoupon(data: {
    storeId: string;
    type: "percentage" | "fixed_amount" | "free_shipping";
    value?: number;
    name: string;
    currency: string;
    usageLimitTotal?: number;
    endsAt?: string;
  }): Promise<{ stripeCouponId: string }> {
    if (data.type === "free_shipping") {
      // free_shipping discounts have no Stripe Coupon — handled locally at checkout
      return { stripeCouponId: "" };
    }

    const stripeAccountId = await this.getStripeAccountId(data.storeId);

    const params: Stripe.CouponCreateParams = {
      name: data.name,
      ...(data.type === "percentage"
        ? { percent_off: data.value }
        : { amount_off: data.value, currency: data.currency }),
      duration: "forever",
      ...(data.usageLimitTotal && { max_redemptions: data.usageLimitTotal }),
      ...(data.endsAt && { redeem_by: Math.floor(new Date(data.endsAt).getTime() / 1000) }),
    };

    try {
      const coupon = await this.stripe.coupons.create(params, {
        stripeAccount: stripeAccountId,
      });
      return { stripeCouponId: coupon.id };
    } catch (err) {
      this.logger.error("Stripe coupon creation failed", err);
      throw new RpcException({ status: 502, message: "Failed to create Stripe coupon" });
    }
  }

  async updateCoupon(data: {
    storeId: string;
    stripeCouponId: string;
    name?: string;
  }): Promise<void> {
    if (!data.stripeCouponId || !data.name) return;
    const stripeAccountId = await this.getStripeAccountId(data.storeId);
    try {
      await this.stripe.coupons.update(
        data.stripeCouponId,
        { name: data.name },
        { stripeAccount: stripeAccountId },
      );
    } catch (err) {
      this.logger.warn("Stripe coupon update failed (non-fatal)", err);
    }
  }

  async deleteCoupon(data: { storeId: string; stripeCouponId: string }): Promise<void> {
    if (!data.stripeCouponId) return;
    const stripeAccountId = await this.getStripeAccountId(data.storeId);
    try {
      await this.stripe.coupons.del(data.stripeCouponId, {
        stripeAccount: stripeAccountId,
      });
    } catch (err) {
      this.logger.warn("Stripe coupon deletion failed (non-fatal)", err);
    }
  }

  async createPromoCode(data: {
    storeId: string;
    stripeCouponId: string;
    code: string;
    currency: string;
    usageLimitTotal?: number;
    minOrderCents?: number;
    endsAt?: string;
  }): Promise<{ stripePromotionCodeId: string }> {
    const stripeAccountId = await this.getStripeAccountId(data.storeId);

    const params: Stripe.PromotionCodeCreateParams = {
      coupon: data.stripeCouponId,
      code: data.code,
      ...(data.usageLimitTotal && { max_redemptions: data.usageLimitTotal }),
      ...(data.endsAt && { expires_at: Math.floor(new Date(data.endsAt).getTime() / 1000) }),
      ...(data.minOrderCents && {
        restrictions: {
          minimum_amount: data.minOrderCents,
          minimum_amount_currency: data.currency,
        },
      }),
    };

    try {
      const promoCode = await this.stripe.promotionCodes.create(params, {
        stripeAccount: stripeAccountId,
      });
      return { stripePromotionCodeId: promoCode.id };
    } catch (err: unknown) {
      const stripeErr = err as Stripe.StripeRawError;
      if (stripeErr?.code === "resource_already_exists") {
        throw new RpcException({ status: 409, message: "Promo code already exists" });
      }
      this.logger.error("Stripe promotion code creation failed", err);
      throw new RpcException({ status: 502, message: "Failed to create Stripe promo code" });
    }
  }

  async deactivatePromoCode(data: {
    storeId: string;
    stripePromotionCodeId: string;
  }): Promise<void> {
    if (!data.stripePromotionCodeId) return;
    const stripeAccountId = await this.getStripeAccountId(data.storeId);
    try {
      await this.stripe.promotionCodes.update(
        data.stripePromotionCodeId,
        { active: false },
        { stripeAccount: stripeAccountId },
      );
    } catch (err) {
      this.logger.warn("Stripe promo code deactivation failed (non-fatal)", err);
    }
  }
}
