import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { DiscountsHandlerService } from "./discounts-handler.service";
import type { CreateDiscountDto, UpdateDiscountDto } from "@sitehaus-ecom/validation";

@Controller()
export class DiscountsHandlerController {
  constructor(private readonly service: DiscountsHandlerService) {}

  @MessagePattern("discounts.list")
  list(@Payload() data: { storeId: string; limit: number; offset: number }) {
    return this.service.list(data);
  }

  @MessagePattern("discounts.get")
  get(@Payload() data: { id: string; storeId: string }) {
    return this.service.get(data);
  }

  @MessagePattern("discounts.create")
  create(@Payload() data: CreateDiscountDto & { storeId: string; stripeCouponId: string | null }) {
    return this.service.create(data);
  }

  @MessagePattern("discounts.update")
  update(@Payload() data: UpdateDiscountDto & { id: string; storeId: string }) {
    return this.service.update(data);
  }

  @MessagePattern("discounts.delete")
  delete(@Payload() data: { id: string; storeId: string }) {
    return this.service.delete(data);
  }

  @MessagePattern("discounts.getStripeCouponId")
  getStripeCouponId(@Payload() data: { id: string; storeId: string }) {
    return this.service.getStripeCouponId(data);
  }

  @MessagePattern("discounts.createCode")
  createCode(
    @Payload()
    data: {
      discountId: string;
      storeId: string;
      code: string;
      stripePromotionCodeId: string;
    },
  ) {
    return this.service.createCode(data);
  }

  @MessagePattern("discounts.deleteCode")
  deleteCode(@Payload() data: { codeId: string; storeId: string }) {
    return this.service.deleteCode(data);
  }

  @MessagePattern("discounts.findApplicableAutomatic")
  findApplicableAutomatic(@Payload() data: { storeId: string; subtotalCents: number }) {
    return this.service.findApplicableAutomatic(data);
  }

  @MessagePattern("discounts.snapshotOnOrder")
  snapshotOnOrder(
    @Payload()
    data: {
      orderId: string;
      discountId: string;
      discountCodeId: string | null;
      codeUsed: string | null;
      amountSavedCents: number;
    },
  ) {
    return this.service.snapshotOnOrder(data);
  }
}
