import {
  apiError,
  createDiscountCodeSchema,
  createDiscountSchema,
  deleteDiscountResponse,
  discountCodeIdParams,
  discountIdParams,
  discountItem,
  discountList,
  updateDiscountSchema,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const discountContract = c.router({
  listDiscounts: {
    method: "GET",
    path: "/v1/admin/discounts",
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0),
    }),
    responses: { 200: discountList, 404: apiError },
    metadata: { openApiTags: ["Discounts"] } as const,
  },
  createDiscount: {
    method: "POST",
    path: "/v1/admin/discounts",
    body: createDiscountSchema,
    responses: { 201: discountItem, 409: apiError },
    metadata: { openApiTags: ["Discounts"] } as const,
  },
  getDiscount: {
    method: "GET",
    path: "/v1/admin/discounts/:id",
    pathParams: discountIdParams,
    responses: { 200: discountItem, 404: apiError },
    metadata: { openApiTags: ["Discounts"] } as const,
  },
  updateDiscount: {
    method: "PATCH",
    path: "/v1/admin/discounts/:id",
    pathParams: discountIdParams,
    body: updateDiscountSchema,
    responses: { 200: discountItem, 404: apiError },
    metadata: { openApiTags: ["Discounts"] } as const,
  },
  deleteDiscount: {
    method: "DELETE",
    path: "/v1/admin/discounts/:id",
    pathParams: discountIdParams,
    body: c.noBody(),
    responses: { 200: deleteDiscountResponse, 404: apiError },
    metadata: { openApiTags: ["Discounts"] } as const,
  },
  createDiscountCode: {
    method: "POST",
    path: "/v1/admin/discounts/:id/codes",
    pathParams: discountIdParams,
    body: createDiscountCodeSchema,
    responses: { 201: discountItem, 409: apiError },
    metadata: { openApiTags: ["Discounts"] } as const,
  },
  deleteDiscountCode: {
    method: "DELETE",
    path: "/v1/admin/discount-codes/:codeId",
    pathParams: discountCodeIdParams,
    body: c.noBody(),
    responses: { 200: deleteDiscountResponse, 404: apiError },
    metadata: { openApiTags: ["Discounts"] } as const,
  },
});
