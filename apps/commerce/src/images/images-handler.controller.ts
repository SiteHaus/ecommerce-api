import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ImagesHandlerService } from "./images-handler.service";

@Controller()
export class ImagesHandlerController {
  constructor(private readonly imagesService: ImagesHandlerService) {}

  @MessagePattern("catalog.images.list")
  list(@Payload() data: { productId: string; storeId: string }) {
    return this.imagesService.list(data);
  }

  @MessagePattern("catalog.images.uploadUrl")
  uploadUrl(@Payload() data: { productId: string; storeId: string; contentType: string }) {
    return this.imagesService.uploadUrl(data);
  }

  @MessagePattern("catalog.images.confirm")
  confirm(
    @Payload() data: { productId: string; storeId: string; r2Key: string; altText?: string },
  ) {
    return this.imagesService.confirm(data);
  }

  @MessagePattern("catalog.images.delete")
  delete(@Payload() data: { productId: string; storeId: string; imageId: string }) {
    return this.imagesService.delete(data);
  }

  @MessagePattern("catalog.images.reorder")
  reorder(
    @Payload()
    data: {
      productId: string;
      storeId: string;
      items: Array<{ imageId: string; sortOrder: number }>;
    },
  ) {
    return this.imagesService.reorder(data);
  }
}
