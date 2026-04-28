import {
  adminNoteSchema,
  apiError,
  createReturnSchema,
  deleteReturnResponse,
  listReturnsQuery,
  returnDetail,
  returnIdParams,
  returnList,
  returnLookupRequest,
  returnLookupResponse,
  returnSettingsResponse,
  updateReturnSettingsSchema,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const returnsContract = c.router({
  // ── Admin: settings ──────────────────────────────────────────────────────────
  getReturnSettings: {
    method: "GET",
    path: "/v1/admin/return-settings",
    responses: { 200: returnSettingsResponse },
    metadata: { openApiTags: ["Returns"] } as const,
  },
  updateReturnSettings: {
    method: "PATCH",
    path: "/v1/admin/return-settings",
    body: updateReturnSettingsSchema,
    responses: { 200: returnSettingsResponse },
    metadata: { openApiTags: ["Returns"] } as const,
  },

  // ── Admin: manage returns ─────────────────────────────────────────────────────
  listReturns: {
    method: "GET",
    path: "/v1/admin/returns",
    query: listReturnsQuery,
    responses: { 200: returnList, 404: apiError },
    metadata: { openApiTags: ["Returns"] } as const,
  },
  getReturn: {
    method: "GET",
    path: "/v1/admin/returns/:id",
    pathParams: returnIdParams,
    responses: { 200: returnDetail, 404: apiError },
    metadata: { openApiTags: ["Returns"] } as const,
  },
  approveReturn: {
    method: "POST",
    path: "/v1/admin/returns/:id/approve",
    pathParams: returnIdParams,
    body: adminNoteSchema,
    responses: { 200: returnDetail, 404: apiError },
    metadata: { openApiTags: ["Returns"] } as const,
  },
  rejectReturn: {
    method: "POST",
    path: "/v1/admin/returns/:id/reject",
    pathParams: returnIdParams,
    body: adminNoteSchema,
    responses: { 200: returnDetail, 404: apiError },
    metadata: { openApiTags: ["Returns"] } as const,
  },
  markReceived: {
    method: "POST",
    path: "/v1/admin/returns/:id/received",
    pathParams: returnIdParams,
    body: adminNoteSchema,
    responses: { 200: returnDetail, 404: apiError },
    metadata: { openApiTags: ["Returns"] } as const,
  },

  // ── Public: no auth ───────────────────────────────────────────────────────────
  lookupOrder: {
    method: "POST",
    path: "/v1/returns/lookup",
    body: returnLookupRequest,
    responses: { 200: returnLookupResponse, 404: apiError, 400: apiError },
    metadata: { openApiTags: ["Returns"] } as const,
  },
  createReturn: {
    method: "POST",
    path: "/v1/returns",
    body: createReturnSchema,
    responses: { 201: returnDetail, 400: apiError, 404: apiError, 409: apiError },
    metadata: { openApiTags: ["Returns"] } as const,
  },

  deleteReturn: {
    method: "DELETE",
    path: "/v1/admin/returns/:id",
    pathParams: returnIdParams,
    body: c.noBody(),
    responses: { 200: deleteReturnResponse, 404: apiError },
    metadata: { openApiTags: ["Returns"] } as const,
  },
});
