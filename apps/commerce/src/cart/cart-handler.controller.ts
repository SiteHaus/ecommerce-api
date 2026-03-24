import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import type { AddCartItemDto, UpdateCartItemDto } from "@sitehaus-ecom/validation";
import { CartHandlerService } from "./cart-handler.service";

type Identity = { storeId: string; sessionToken?: string; userId?: string };

@Controller()
export class CartHandlerController {
  constructor(private readonly cartService: CartHandlerService) {}

  @MessagePattern("cart.get")
  get(@Payload() data: Identity) {
    return this.cartService.get(data);
  }

  @MessagePattern("cart.addItem")
  addItem(@Payload() data: Identity & AddCartItemDto) {
    const { variantId, quantity, ...identity } = data;
    return this.cartService.addItem(identity, variantId, quantity);
  }

  @MessagePattern("cart.updateItem")
  updateItem(@Payload() data: Identity & { variantId: string } & UpdateCartItemDto) {
    const { variantId, quantity, ...identity } = data;
    return this.cartService.updateItem(identity, variantId, quantity);
  }

  @MessagePattern("cart.removeItem")
  removeItem(@Payload() data: Identity & { variantId: string }) {
    const { variantId, ...identity } = data;
    return this.cartService.removeItem(identity, variantId);
  }

  @MessagePattern("cart.merge")
  merge(@Payload() data: { storeId: string; sessionToken: string; userId: string }) {
    return this.cartService.merge(data.storeId, data.sessionToken, data.userId);
  }
}
