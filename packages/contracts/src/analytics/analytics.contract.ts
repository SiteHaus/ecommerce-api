import {
  abandonedCartsListQuerySchema,
  abandonedCartsListSchema,
  abandonedCartsSchema,
  analyticsDateRangeSchema,
  apiError,
  funnelSchema,
  revenueDashboardSchema,
  revenueQuerySchema,
  topProductsDashboardSchema,
  topProductsQuerySchema,
  trackEventSchema,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const analyticsContract = c.router({
  trackEvent: {
    method: "POST",
    path: "/v1/analytics/events",
    body: trackEventSchema,
    responses: {
      204: z.object({}),
      400: apiError,
    },
    metadata: { openApiTags: ["Analytics"] } as const,
  },
  adminRevenue: {
    method: "GET",
    path: "/v1/admin/analytics/revenue",
    query: revenueQuerySchema,
    responses: {
      200: revenueDashboardSchema,
    },
    metadata: { openApiTags: ["Analytics Admin"] } as const,
  },
  adminTopProducts: {
    method: "GET",
    path: "/v1/admin/analytics/top-products",
    query: topProductsQuerySchema,
    responses: {
      200: topProductsDashboardSchema,
    },
    metadata: { openApiTags: ["Analytics Admin"] } as const,
  },
  adminFunnel: {
    method: "GET",
    path: "/v1/admin/analytics/funnel",
    query: analyticsDateRangeSchema,
    responses: {
      200: funnelSchema,
    },
    metadata: { openApiTags: ["Analytics Admin"] } as const,
  },
  adminAbandonedCarts: {
    method: "GET",
    path: "/v1/admin/analytics/abandoned-carts",
    query: analyticsDateRangeSchema,
    responses: {
      200: abandonedCartsSchema,
    },
    metadata: { openApiTags: ["Analytics Admin"] } as const,
  },
  adminAbandonedCartsList: {
    method: "GET",
    path: "/v1/admin/analytics/abandoned-carts/list",
    query: abandonedCartsListQuerySchema,
    responses: {
      200: abandonedCartsListSchema,
    },
    metadata: { openApiTags: ["Analytics Admin"] } as const,
  },
});
