import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { WebhooksHandlerService } from "./webhooks-handler.service";

@Controller()
export class WebhooksHandlerController {
  constructor(private readonly webhooks: WebhooksHandlerService) {}

  @MessagePattern("webhooks.list")
  list(@Payload() data: { storeId: string }) {
    return this.webhooks.list(data.storeId);
  }

  @MessagePattern("webhooks.create")
  create(@Payload() data: { storeId: string; url: string; events: string[] }) {
    return this.webhooks.create(data.storeId, { url: data.url, events: data.events });
  }

  @MessagePattern("webhooks.update")
  update(
    @Payload()
    data: {
      storeId: string;
      endpointId: string;
      url?: string;
      events?: string[];
      isActive?: boolean;
    },
  ) {
    return this.webhooks.update(data.storeId, data.endpointId, {
      url: data.url,
      events: data.events,
      isActive: data.isActive,
    });
  }

  @MessagePattern("webhooks.delete")
  delete(@Payload() data: { storeId: string; endpointId: string }) {
    return this.webhooks.delete(data.storeId, data.endpointId);
  }

  @MessagePattern("webhooks.listDeliveries")
  listDeliveries(@Payload() data: { storeId: string; endpointId: string }) {
    return this.webhooks.listDeliveries(data.storeId, data.endpointId);
  }
}
