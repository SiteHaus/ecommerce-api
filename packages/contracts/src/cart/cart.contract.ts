import {
  addCartItemSchema,
  apiError,
  cartSchema,
  cartVariantParam,
  updateCartItemSchema,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const cartContract = c.router({
  getCart: {
    method: "GET",
    path: "/v1/cart",
    responses: {
      200: cartSchema,
    },
    metadata: { openApiTags: ["Cart"] } as const,
  },
  addItem: {
    method: "POST",
    path: "/v1/cart/items",
    body: addCartItemSchema,
    responses: {
      200: cartSchema,
      400: apiError,
      404: apiError,
    },
    metadata: { openApiTags: ["Cart"] } as const,
  },
  updateItem: {
    method: "PATCH",
    path: "/v1/cart/items/:variantId",
    pathParams: cartVariantParam,
    body: updateCartItemSchema,
    responses: {
      200: cartSchema,
      404: apiError,
    },
    metadata: { openApiTags: ["Cart"] } as const,
  },
  removeItem: {
    method: "DELETE",
    path: "/v1/cart/items/:variantId",
    pathParams: cartVariantParam,
    body: c.noBody(),
    responses: {
      200: cartSchema,
      404: apiError,
    },
    metadata: { openApiTags: ["Cart"] } as const,
  },
});
