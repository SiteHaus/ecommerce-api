import {
  apiError,
  inventoryItem,
  inventoryVariantParam,
  listInventoryQuery,
  listInventoryResponse,
  updateInventorySchema,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const inventoryContract = c.router({
  listInventory: {
    method: "GET",
    path: "/v1/admin/inventory",
    query: listInventoryQuery,
    responses: {
      200: listInventoryResponse,
    },
    metadata: { openApiTags: ["Inventory"] } as const,
  },
  getInventory: {
    method: "GET",
    path: "/v1/admin/inventory/:variantId",
    pathParams: inventoryVariantParam,
    responses: {
      200: inventoryItem,
      404: apiError,
    },
    metadata: { openApiTags: ["Inventory"] } as const,
  },
  adjust: {
    method: "PATCH",
    path: "/v1/admin/inventory/:variantId",
    pathParams: inventoryVariantParam,
    body: updateInventorySchema,
    responses: {
      200: inventoryItem,
      400: apiError,
      404: apiError,
    },
    metadata: { openApiTags: ["Inventory"] } as const,
  },
});
