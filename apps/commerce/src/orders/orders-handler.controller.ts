import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { OrdersHandlerService } from "./orders-handler.service";

@Controller()
export class OrdersHandlerController {
  constructor(private readonly orders: OrdersHandlerService) {}

  @MessagePattern("orders.getForCustomer")
  getForCustomer(
    @Payload() data: { storeId: string; orderId: string; userId?: string; email?: string },
  ) {
    return this.orders.getForCustomer(data);
  }

  @MessagePattern("orders.listForCustomer")
  listForCustomer(
    @Payload() data: { storeId: string; userId: string; limit: number; offset: number },
  ) {
    return this.orders.listForCustomer(data);
  }

  @MessagePattern("orders.adminGet")
  adminGet(@Payload() data: { storeId: string; orderId: string }) {
    return this.orders.adminGet(data);
  }

  @MessagePattern("orders.adminList")
  adminList(
    @Payload()
    data: {
      storeId: string;
      status?: string[];
      email?: string;
      limit: number;
      offset: number;
      sort: "newest" | "oldest";
    },
  ) {
    return this.orders.adminList(data);
  }
}
