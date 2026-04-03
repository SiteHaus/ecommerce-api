import { Controller } from "@nestjs/common";
import { CollectionsHandlerService } from "./collections-handler.service";
import {
  VerifyProductDto,
  CreateCollectionDto,
  DeleteCollectionDto,
  ReorderCollectionDto,
  UpdateCollectionDto,
} from "@sitehaus-ecom/validation";
import { Payload } from "@nestjs/microservices";
import { MessagePattern } from "@nestjs/microservices";

@Controller()
export class CollectionsHandlerController {
  constructor(private readonly collectionService: CollectionsHandlerService) {}

  @MessagePattern("catalog.collections.create")
  create(@Payload() data: CreateCollectionDto & { storeId: string }) {
    return this.collectionService.create(data);
  }

  @MessagePattern("catalog.collections.update")
  update(@Payload() data: UpdateCollectionDto & { storeId: string; collectionId: string }) {
    return this.collectionService.update(data);
  }

  @MessagePattern("catalog.collections.delete")
  delete(@Payload() data: DeleteCollectionDto & { collectionId: string; storeId: string }) {
    return this.collectionService.delete(data);
  }

  @MessagePattern("catalog.collections.verify")
  addProduct(@Payload() data: VerifyProductDto & { storeId: string; collectionId: string }) {
    return this.collectionService.verify(data);
  }

  @MessagePattern("catalog.collections.reorderProducts")
  reorder(@Payload() data: ReorderCollectionDto & { storeId: string; collectionId: string }) {
    return this.collectionService.reorder(data);
  }

  @MessagePattern("catalog.collections.list")
  list(@Payload() data: { storeId: string }) {
    return this.collectionService.list(data.storeId);
  }

  @MessagePattern("catalog.collections.getCollection")
  getCollection(@Payload() data: { storeId: string; slug: string }) {
    return this.collectionService.getCollection(data.storeId, data.slug);
  }
}
