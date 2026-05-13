import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import type { ListInventoryQuery, UpdateInventoryDto } from "@sitehaus-ecom/validation";
import { InventoryHandlerService } from "./inventory-handler.service";

@Controller()
export class InventoryHandlerController {
  constructor(private readonly inventoryService: InventoryHandlerService) {}

  @MessagePattern("inventory.list")
  list(@Payload() data: { storeId: string } & ListInventoryQuery) {
    const { storeId, ...query } = data;
    return this.inventoryService.list(storeId, query);
  }

  @MessagePattern("inventory.get")
  get(@Payload() data: { variantId: string; storeId: string }) {
    return this.inventoryService.get(data.variantId, data.storeId);
  }

  @MessagePattern("inventory.adjust")
  adjust(@Payload() data: { variantId: string; storeId: string } & UpdateInventoryDto) {
    const { variantId, storeId, ...update } = data;
    return this.inventoryService.adjust(variantId, storeId, update);
  }
}
