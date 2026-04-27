import {
  apiError,
  createOptionSchema,
  createOptionValueSchema,
  deleteOptionResponse,
  optionIdParams,
  optionItem,
  optionProductParams,
  optionValueIdParams,
  optionValueItem,
  updateOptionSchema,
  updateOptionValueSchema,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const optionsContract = c.router({
  createOption: {
    method: "POST",
    path: "/v1/admin/products/:productId/options",
    pathParams: optionProductParams,
    body: createOptionSchema,
    responses: { 201: optionItem, 404: apiError },
    metadata: { openApiTags: ["Options"] } as const,
  },
  updateOption: {
    method: "PATCH",
    path: "/v1/admin/options/:optionId",
    pathParams: optionIdParams,
    body: updateOptionSchema,
    responses: { 200: optionItem, 404: apiError },
    metadata: { openApiTags: ["Options"] } as const,
  },
  deleteOption: {
    method: "DELETE",
    path: "/v1/admin/options/:optionId",
    pathParams: optionIdParams,
    body: c.noBody(),
    responses: { 200: deleteOptionResponse, 404: apiError },
    metadata: { openApiTags: ["Options"] } as const,
  },
  createOptionValue: {
    method: "POST",
    path: "/v1/admin/options/:optionId/values",
    pathParams: optionIdParams,
    body: createOptionValueSchema,
    responses: { 201: optionValueItem, 404: apiError },
    metadata: { openApiTags: ["Options"] } as const,
  },
  updateOptionValue: {
    method: "PATCH",
    path: "/v1/admin/option-values/:valueId",
    pathParams: optionValueIdParams,
    body: updateOptionValueSchema,
    responses: { 200: optionValueItem, 404: apiError },
    metadata: { openApiTags: ["Options"] } as const,
  },
  deleteOptionValue: {
    method: "DELETE",
    path: "/v1/admin/option-values/:valueId",
    pathParams: optionValueIdParams,
    body: c.noBody(),
    responses: { 200: deleteOptionResponse, 404: apiError },
    metadata: { openApiTags: ["Options"] } as const,
  },
});
