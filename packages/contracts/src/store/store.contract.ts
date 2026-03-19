import {
  apiError,
  createStoreSchema,
  storeItem,
  updateStoreSchema,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const storeContract = c.router({
  getMe: {
    method: "GET",
    path: "/v1/admin/stores/me",
    responses: {
      200: storeItem,
      404: apiError,
    },
    metadata: { openApiTags: ["Stores"] } as const,
  },
  create: {
    method: "POST",
    path: "/v1/admin/stores",
    body: createStoreSchema,
    responses: {
      201: storeItem,
      409: apiError,
    },
    metadata: { openApiTags: ["Stores"] } as const,
  },
  update: {
    method: "PATCH",
    path: "/v1/admin/stores",
    body: updateStoreSchema,
    responses: {
      200: storeItem,
      409: apiError,
    },
    metadata: { openApiTags: ["Stores"] } as const,
  },
});
