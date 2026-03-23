import {
  apiError,
  createProductSchema,
  updateProductSchema,
  productItem,
  productIdParams,
  adminQueryParams,
  productList,
  publicQueryParams,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const productContract = c.router({
  listAdminProducts: {
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
  update: {
    method: "PATCH",
    path: "/v1/admin/products/:id",
    body: updateProductSchema,
    query: productIdParams,
    responses: {
      200: productItem,
      409: apiError,
    },
    metadata: { openApiTags: ["Products"] } as const,
  },
  delete: {
    method: "DELETE",
    path: "/v1/admin/products/:id",
    query: productIdParams,
    body: c.noBody(),
    responses: {
      200: productItem,
      404: apiError,
    },
    metadata: { openApiTags: ["Products"] } as const,
  },
  listProducts: {
    method: "GET",
    path: "/v1/catalog/products",
    query: publicQueryParams,
    responses: {
      200: productList,
      404: apiError,
    },
    metadata: { openApiTags: ["Products"] } as const,
  },
  getProduct: {
    method: "GET",
    path: "/v1/catalog/products/:id",
    query: productIdParams,
    responses: {
      200: productItem,
      404: apiError,
    },
    metadata: { openApiTags: ["Products"] } as const,
  },
});
