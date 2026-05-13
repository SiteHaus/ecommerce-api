import {
  apiError,
  createCollectionSchema,
  updateCollectionSchema,
  collectionItem,
  collectionIdParams,
  collectionDetail,
  deleteCollectionResponse,
  reorderCollectionSchema,
  collectionListSchema,
  slugIdParams,
  verifyProduct,
  publicCollectionListSchema,
  publicCollectionDetail,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const collectionContract = c.router({
  createCollection: {
    method: "POST",
    path: "/v1/admin/collections",
    body: createCollectionSchema,
    responses: {
      200: collectionItem,
      409: apiError,
    },
    metadata: { openApiTags: ["Collections"] } as const,
  },
  updateCollection: {
    method: "PATCH",
    path: "/v1/admin/collections/:id",
    body: updateCollectionSchema,
    pathParams: collectionIdParams,
    responses: {
      200: collectionItem,
      409: apiError,
    },
    metadata: { openApiTags: ["Collections"] } as const,
  },
  verify: {
    method: "POST",
    path: "/v1/admin/collections/:id/products",
    body: verifyProduct,
    pathParams: collectionIdParams,
    responses: {
      200: collectionItem,
      409: apiError,
    },
    metadata: { openApiTags: ["Collections"] } as const,
  },
  deleteCollection: {
    method: "DELETE",
    path: "/v1/admin/collections/:id",
    body: c.noBody(),
    pathParams: collectionIdParams,
    responses: {
      200: deleteCollectionResponse,
      409: apiError,
    },
    metadata: { openApiTags: ["Collections"] } as const,
  },
  reorder: {
    method: "POST",
    path: "/v1/admin/collections/:id/reorder",
    body: reorderCollectionSchema,
    pathParams: collectionIdParams,
    responses: {
      200: reorderCollectionSchema,
      409: apiError,
    },
    metadata: { openApiTags: ["Collections"] } as const,
  },
  list: {
    method: "GET",
    path: "/v1/admin/collections",
    responses: {
      200: collectionListSchema,
      409: apiError,
    },
    metadata: { openApiTags: ["Collections"] } as const,
  },
  getCollection: {
    method: "GET",
    path: "/v1/admin/collections/:id",
    pathParams: collectionIdParams,
    responses: {
      200: collectionDetail,
      409: apiError,
    },
    metadata: { openApiTags: ["Collections"] } as const,
  },
  // Public storefront routes
  listCatalogCollections: {
    method: "GET",
    path: "/v1/catalog/collections",
    responses: {
      200: publicCollectionListSchema,
    },
    metadata: { openApiTags: ["Catalog"] } as const,
  },
  getCatalogCollection: {
    method: "GET",
    path: "/v1/catalog/collections/:slug",
    pathParams: slugIdParams,
    responses: {
      200: publicCollectionDetail,
      404: apiError,
    },
    metadata: { openApiTags: ["Catalog"] } as const,
  },
});
