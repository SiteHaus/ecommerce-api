import {
  apiError,
  uploadUrlSchema,
  uploadUrlResponse,
  confirmImageSchema,
  productImageItem,
  productImageParams,
  productImageWithImageParams,
  reorderImagesSchema,
  deleteImageResponse,
  productImageList,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const imagesContract = c.router({
  uploadUrl: {
    method: "POST",
    path: "/v1/admin/products/:id/images/upload-url",
    pathParams: productImageParams,
    body: uploadUrlSchema,
    responses: { 201: uploadUrlResponse, 404: apiError },
    metadata: { openApiTags: ["Images"] } as const,
  },
  confirm: {
    method: "POST",
    path: "/v1/admin/products/:id/images/confirm",
    pathParams: productImageParams,
    body: confirmImageSchema,
    responses: { 201: productImageItem, 404: apiError, 422: apiError },
    metadata: { openApiTags: ["Images"] } as const,
  },
  delete: {
    method: "DELETE",
    path: "/v1/admin/products/:id/images/:imageId",
    pathParams: productImageWithImageParams,
    body: c.noBody(),
    responses: { 200: deleteImageResponse, 404: apiError },
    metadata: { openApiTags: ["Images"] } as const,
  },
  reorder: {
    method: "PATCH",
    path: "/v1/admin/products/:id/images/reorder",
    pathParams: productImageParams,
    body: reorderImagesSchema,
    responses: { 200: productImageList, 404: apiError },
    metadata: { openApiTags: ["Images"] } as const,
  },
});
