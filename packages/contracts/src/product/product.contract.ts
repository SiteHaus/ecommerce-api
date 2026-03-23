import {
  apiError,
  createProductSchema,
  updateProductSchema,
  productItem,
  productDetail,
  productIdParams,
  adminQueryParams,
  productList,
  publicQueryParams,
  deleteProductResponse,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const productContract = c.router({
  // Admin routes
  list: {
    method: "GET",
    path: "/v1/admin/products",
    query: adminQueryParams,
    responses: {
      200: productList,
      404: apiError,
    },
    metadata: { openApiTags: ["Products"] } as const,
  },
  create: {
    method: "POST",
    path: "/v1/admin/products",
    body: createProductSchema,
    responses: {
      201: productItem,
      409: apiError,
    },
    metadata: { openApiTags: ["Products"] } as const,
  },
  get: {
    method: "GET",
    path: "/v1/admin/products/:id",
    pathParams: productIdParams,
    responses: {
      200: productDetail,
      404: apiError,
    },
    metadata: { openApiTags: ["Products"] } as const,
  },
  update: {
    method: "PATCH",
    path: "/v1/admin/products/:id",
    pathParams: productIdParams,
    body: updateProductSchema,
    responses: {
      200: productItem,
      409: apiError,
    },
    metadata: { openApiTags: ["Products"] } as const,
  },
  delete: {
    method: "DELETE",
    path: "/v1/admin/products/:id",
    pathParams: productIdParams,
    body: c.noBody(),
    responses: {
      200: deleteProductResponse,
      404: apiError,
    },
    metadata: { openApiTags: ["Products"] } as const,
  },
  // Public routes
  listPublic: {
    method: "GET",
    path: "/v1/catalog/products",
    query: publicQueryParams,
    responses: {
      200: productList,
      404: apiError,
    },
    metadata: { openApiTags: ["Products"] } as const,
  },
  getPublic: {
    method: "GET",
    path: "/v1/catalog/products/:id",
    pathParams: productIdParams,
    responses: {
      200: productDetail,
      404: apiError,
    },
    metadata: { openApiTags: ["Products"] } as const,
  },
});
