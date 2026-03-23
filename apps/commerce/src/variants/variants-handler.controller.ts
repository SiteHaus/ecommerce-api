import { Controller } from "@nestjs/common";
import { VariantsHandlerService } from "./variants-handler.service";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { CreateVariantDto, UpdateVariantDto } from "@sitehaus-ecom/validation";

@Controller("variants")
export class VariantsHandlerController {
  constructor(private readonly variantService: VariantsHandlerService) {}

  @MessagePattern("catalog.variants.create")
  create(
    @Payload() data: CreateVariantDto & { productId: string; storeId: string },
  ) {
    return this.variantService.create(data);
  }

  @MessagePattern("catalog.variants.update")
  update(
    @Payload()
    data: UpdateVariantDto & { id: string; storeId: string },
  ) {
    return this.variantService.update(data);
  }

  @MessagePattern("catalog.variants.delete")
  delete(@Payload() data: { id: string; storeId: string }) {
    return this.variantService.delete(data);
  }
}
