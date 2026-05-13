import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { CustomersHandlerService } from "./customers-handler.service";
import type { ListCustomersQuery, UpdateCustomerDto } from "@sitehaus-ecom/validation";

@Controller()
export class CustomersHandlerController {
  constructor(private readonly service: CustomersHandlerService) {}

  @MessagePattern("customers.list")
  list(@Payload() data: ListCustomersQuery & { storeId: string }) {
    return this.service.list(data);
  }

  @MessagePattern("customers.get")
  get(@Payload() data: { id: string; storeId: string }) {
    return this.service.get(data);
  }

  @MessagePattern("customers.update")
  update(@Payload() data: UpdateCustomerDto & { id: string; storeId: string }) {
    return this.service.update(data);
  }

  @MessagePattern("customers.myProfile")
  myProfile(@Payload() data: { storeId: string; userId: string }) {
    return this.service.myProfile(data);
  }

  @MessagePattern("customers.myOrders")
  myOrders(@Payload() data: { storeId: string; userId: string }) {
    return this.service.myOrders(data);
  }
}
