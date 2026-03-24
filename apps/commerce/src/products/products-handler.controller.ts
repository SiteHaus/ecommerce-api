import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import {
  AdminQueryParams,
  CreateProductDto,
  PublicQueryParams,
  UpdateProductDto,
} from "@sitehaus-ecom/validation";
import { ProductsHandlerService } from "./products-handler.service";

@Controller("products")
export class ProductsHandlerController {
  constructor(private readonly productService: ProductsHandlerService) {}

  @MessagePattern("catalog.products.create")
  create(@Payload() data: CreateProductDto & { storeId: string }) {
    return this.productService.create(data);
  }

  @MessagePattern("catalog.products.update")
  update(@Payload() data: UpdateProductDto & { id: string; storeId: string }) {
    return this.productService.update(data);
  }

  @MessagePattern("catalog.products.archive")
  delete(@Payload() data: { id: string; storeId: string }) {
    return this.productService.delete(data);
  }

  @MessagePattern("catalog.products.list")
  listProducts(@Payload() data: AdminQueryParams & { storeId: string }) {
    return this.productService.listProducts(data);
  }

  @MessagePattern("catalog.products.get")
  getProduct(@Payload() data: { id: string; storeId: string }) {
    return this.productService.getProduct(data);
  }

  @MessagePattern("catalog.products.listPublic")
  listPublic(@Payload() data: PublicQueryParams & { storeId: string }) {
    return this.productService.listPublic(data);
  }
}
