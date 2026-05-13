import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { DiscountSyncService } from "./discount-sync.service";

@Controller()
export class DiscountSyncHandler {
  constructor(private readonly service: DiscountSyncService) {}

  @MessagePattern("payments.discounts.createCoupon")
  createCoupon(
    @Payload()
    data: {
      storeId: string;
      type: "percentage" | "fixed_amount" | "free_shipping";
      value?: number;
      name: string;
      currency: string;
      usageLimitTotal?: number;
      endsAt?: string;
    },
  ) {
    return this.service.createCoupon(data);
  }

  @MessagePattern("payments.discounts.updateCoupon")
  updateCoupon(@Payload() data: { storeId: string; stripeCouponId: string; name?: string }) {
    return this.service.updateCoupon(data);
  }

  @MessagePattern("payments.discounts.deleteCoupon")
  deleteCoupon(@Payload() data: { storeId: string; stripeCouponId: string }) {
    return this.service.deleteCoupon(data);
  }

  @MessagePattern("payments.discounts.createPromoCode")
  createPromoCode(
    @Payload()
    data: {
      storeId: string;
      stripeCouponId: string;
      code: string;
      currency: string;
      usageLimitTotal?: number;
      minOrderCents?: number;
      endsAt?: string;
    },
  ) {
    return this.service.createPromoCode(data);
  }

  @MessagePattern("payments.discounts.deactivatePromoCode")
  deactivatePromoCode(@Payload() data: { storeId: string; stripePromotionCodeId: string }) {
    return this.service.deactivatePromoCode(data);
  }
}
