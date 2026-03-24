import {
  apiError,
  connectStripeResponse,
  connectStripeSchema,
  createStoreSchema,
  storeItem,
  stripeStatusItem,
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
  createStore: {
    method: "POST",
    path: "/v1/admin/stores",
    body: createStoreSchema,
    responses: {
      201: storeItem,
      409: apiError,
    },
    metadata: { openApiTags: ["Stores"] } as const,
  },
  updateStore: {
    method: "PATCH",
    path: "/v1/admin/stores",
    body: updateStoreSchema,
    responses: {
      200: storeItem,
      409: apiError,
    },
    metadata: { openApiTags: ["Stores"] } as const,
  },
  connectStripe: {
    method: "POST",
    path: "/v1/admin/stores/connect-stripe",
    body: connectStripeSchema,
    responses: {
      200: connectStripeResponse,
    },
    metadata: { openApiTags: ["Stores"] } as const,
  },
  stripeStatus: {
    method: "GET",
    path: "/v1/admin/stores/stripe-status",
    responses: {
      200: stripeStatusItem,
    },
    metadata: { openApiTags: ["Stores"] } as const,
  },
});
