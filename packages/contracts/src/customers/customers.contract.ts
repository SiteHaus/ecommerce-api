import {
  apiError,
  customerDetail,
  customerIdParams,
  customerItem,
  customerList,
  listCustomersQuery,
  myOrdersResponse,
  myProfileResponse,
  updateCustomerSchema,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const customersContract = c.router({
  // ── Admin endpoints ─────────────────────────────────────────────────────────
  listCustomers: {
    method: "GET",
    path: "/v1/admin/customers",
    query: listCustomersQuery,
    responses: { 200: customerList, 404: apiError },
    metadata: { openApiTags: ["Customers"] } as const,
  },
  getCustomer: {
    method: "GET",
    path: "/v1/admin/customers/:id",
    pathParams: customerIdParams,
    responses: { 200: customerDetail, 404: apiError },
    metadata: { openApiTags: ["Customers"] } as const,
  },
  updateCustomer: {
    method: "PATCH",
    path: "/v1/admin/customers/:id",
    pathParams: customerIdParams,
    body: updateCustomerSchema,
    responses: { 200: customerItem, 404: apiError },
    metadata: { openApiTags: ["Customers"] } as const,
  },

  // ── Customer-facing endpoints ────────────────────────────────────────────────
  myProfile: {
    method: "GET",
    path: "/v1/me/profile",
    responses: { 200: myProfileResponse, 404: apiError },
    metadata: { openApiTags: ["Me"] } as const,
  },
  myOrders: {
    method: "GET",
    path: "/v1/me/orders",
    responses: { 200: myOrdersResponse, 404: apiError },
    metadata: { openApiTags: ["Me"] } as const,
  },
});
