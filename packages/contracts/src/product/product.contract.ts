import {
  adminQueryParams,
  apiError,
  createProductSchema,
  deleteProductResponse,
  productDetail,
  productIdParams,
  productItem,
  productList,
  publicProductDetailFull,
  publicProductList,
  publicQueryParams,
  updateProductSchema,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const productContract = c.router({
  listProducts: {
    method: "GET",
    path: "/v1/admin/products",
    query: adminQueryParams,
    responses: { 200: productList, 404: apiError },
    metadata: { openApiTags: ["Products"] } as const,
  },
  createProduct: {
    method: "POST",
    path: "/v1/admin/products",
    body: createProductSchema,
    responses: { 201: productItem, 409: apiError },
    metadata: { openApiTags: ["Products"] } as const,
  },
  getProduct: {
    method: "GET",
    path: "/v1/admin/products/:id",
    pathParams: productIdParams,
    responses: { 200: productDetail, 404: apiError },
    metadata: { openApiTags: ["Products"] } as const,
  },
  updateProduct: {
    method: "PATCH",
    path: "/v1/admin/products/:id",
    pathParams: productIdParams,
    body: updateProductSchema,
    responses: { 200: productItem, 409: apiError },
    metadata: { openApiTags: ["Products"] } as const,
  },
  deleteProduct: {
    method: "DELETE",
    path: "/v1/admin/products/:id",
    pathParams: productIdParams,
    body: c.noBody(),
    responses: { 200: deleteProductResponse, 404: apiError },
    metadata: { openApiTags: ["Products"] } as const,
  },
  listPublic: {
    method: "GET",
    path: "/v1/catalog/products",
    query: publicQueryParams,
    responses: { 200: publicProductList, 404: apiError },
    metadata: { openApiTags: ["Catalog"] } as const,
  },
  getPublicProduct: {
    method: "GET",
    path: "/v1/catalog/products/:id",
    pathParams: productIdParams,
    responses: { 200: publicProductDetailFull, 404: apiError },
    metadata: { openApiTags: ["Catalog"] } as const,
  },
});
