import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ReturnsHandlerService } from "./returns-handler.service";
import type {
  CreateReturnDto,
  ListReturnsQuery,
  UpdateReturnSettingsDto,
} from "@sitehaus-ecom/validation";

@Controller()
export class ReturnsHandlerController {
  constructor(private readonly service: ReturnsHandlerService) {}

  @MessagePattern("returns.getSettings")
  getSettings(@Payload() data: { storeId: string }) {
    return this.service.getSettings(data.storeId);
  }

  @MessagePattern("returns.updateSettings")
  updateSettings(@Payload() data: UpdateReturnSettingsDto & { storeId: string }) {
    const { storeId, ...rest } = data;
    return this.service.updateSettings(storeId, rest);
  }

  @MessagePattern("returns.lookup")
  lookup(@Payload() data: { storeId: string; orderId: string; email: string }) {
    return this.service.lookupOrder(data.storeId, data.orderId, data.email);
  }

  @MessagePattern("returns.create")
  create(@Payload() data: CreateReturnDto & { storeId: string }) {
    const { storeId, ...rest } = data;
    return this.service.createReturn(storeId, rest);
  }

  @MessagePattern("returns.list")
  list(@Payload() data: ListReturnsQuery & { storeId: string }) {
    const { storeId, ...query } = data;
    return this.service.list(storeId, query);
  }

  @MessagePattern("returns.get")
  get(@Payload() data: { id: string; storeId: string }) {
    return this.service.getReturn(data.storeId, data.id);
  }

  @MessagePattern("returns.approve")
  approve(@Payload() data: { id: string; storeId: string; adminNotes?: string | null }) {
    return this.service.approve(data.storeId, data.id, data.adminNotes);
  }

  @MessagePattern("returns.reject")
  reject(@Payload() data: { id: string; storeId: string; adminNotes?: string | null }) {
    return this.service.reject(data.storeId, data.id, data.adminNotes);
  }

  @MessagePattern("returns.markReceived")
  markReceived(@Payload() data: { id: string; storeId: string; adminNotes?: string | null }) {
    return this.service.markReceived(data.storeId, data.id, data.adminNotes);
  }

  @MessagePattern("returns.delete")
  delete(@Payload() data: { id: string; storeId: string }) {
    return this.service.delete(data.storeId, data.id);
  }
}
