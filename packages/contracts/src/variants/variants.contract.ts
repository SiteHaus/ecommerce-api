import {
  apiError,
  createVariantSchema,
  updateVariantSchema,
  variantItem,
  deleteVariantSchema,
  variantPathParams,
  variantIdParams,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const variantContract = c.router({
  createVariant: {
    method: "POST",
    path: "/v1/admin/products/:productId/variants",
    body: createVariantSchema,
    pathParams: variantPathParams,
    responses: {
      201: variantItem,
      409: apiError,
    },
    metadata: { openApiTags: ["Variants"] } as const,
  },
  updateVariant: {
    method: "PATCH",
    path: "/v1/admin/variants/:id",
    body: updateVariantSchema,
    pathParams: variantIdParams,
    responses: {
      200: variantItem,
      409: apiError,
    },
    metadata: { openApiTags: ["Variants"] } as const,
  },
  deleteVariant: {
    method: "DELETE",
    path: "/v1/admin/variants/:id",
    pathParams: variantIdParams,
    body: c.noBody(),
    responses: {
      200: deleteVariantSchema,
      409: apiError,
    },
    metadata: { openApiTags: ["Variants"] } as const,
  },
});
