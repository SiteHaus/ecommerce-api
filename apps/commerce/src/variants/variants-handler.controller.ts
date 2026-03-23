import { Controller } from "@nestjs/common";
import { VariantsHandlerService } from "./variants-handler.service";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { UpdateVariantDto, CreateVariantDto } from "@sitehaus-ecom/validation";

@Controller("variants")
export class VariantsHandlerController {
  constructor(private readonly variantService: VariantsHandlerService) {}

  @MessagePattern("catalog.variants.create")
  create(@Payload() data: CreateVariantDto) {
    return this.variantService.create(data);
  }

  @MessagePattern("catalog.variants.update")
  update(
    @Payload()
    data: UpdateVariantDto,
  ) {
    return this.variantService.update(data);
  }

  @MessagePattern("catalog.variants.delete")
  delete(@Payload() data: { id: string; storeId: string }) {
    return this.variantService.delete(data);
  }
}
