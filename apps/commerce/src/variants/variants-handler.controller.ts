import { Controller } from "@nestjs/common";
import { VariantsHandlerService } from "./variants-handler.service";
import { VariationsSyncService } from "./variations-sync.service";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { CreateVariantDto, UpdateVariantDto, SyncVariationsDto } from "@sitehaus-ecom/validation";

@Controller()
export class VariantsHandlerController {
  constructor(
    private readonly variantService: VariantsHandlerService,
    private readonly variationsSync: VariationsSyncService,
  ) {}

  @MessagePattern("catalog.variants.create")
  create(
    @Payload()
    data: CreateVariantDto & { productId: string; storeId: string; optionValueIds?: string[] },
  ) {
    return this.variantService.create(data);
  }

  @MessagePattern("catalog.variants.update")
  update(
    @Payload()
    data: UpdateVariantDto & { id: string; storeId: string; optionValueIds?: string[] },
  ) {
    return this.variantService.update(data);
  }

  @MessagePattern("catalog.variants.delete")
  delete(@Payload() data: { id: string; storeId: string }) {
    return this.variantService.delete(data);
  }

  @MessagePattern("catalog.variations.sync")
  syncVariations(@Payload() data: { productId: string; storeId: string } & SyncVariationsDto) {
    return this.variationsSync.sync(data);
  }
}
