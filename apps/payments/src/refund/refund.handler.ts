import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { RefundService } from "./refund.service";

@Controller()
export class RefundHandler {
  constructor(private readonly refund: RefundService) {}

  @MessagePattern("payments.refund")
  handleRefund(
    @Payload()
    data: {
      storeId: string;
      orderId: string;
      store: { stripeAccountId: string };
    },
  ) {
    return this.refund.refund(data);
  }
}
