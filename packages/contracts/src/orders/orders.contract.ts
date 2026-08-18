import {
  adminListOrdersQuerySchema,
  adminOrderDetailSchema,
  adminOrderListSchema,
  apiError,
  getOrderQuerySchema,
  listOrdersQuerySchema,
  orderDetailSchema,
  orderListSchema,
  shipOrderBodySchema,
  updateShippingAddressBodySchema,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const ordersContract = c.router({
  getOrder: {
    method: "GET",
    path: "/v1/orders/:orderId",
    pathParams: z.object({ orderId: z.string().uuid() }),
    query: getOrderQuerySchema,
    responses: {
      200: orderDetailSchema,
      403: apiError,
      404: apiError,
    },
    metadata: { openApiTags: ["Orders"] } as const,
  },
  listOrders: {
    method: "GET",
    path: "/v1/orders",
    query: listOrdersQuerySchema,
    responses: {
      200: orderListSchema,
    },
    metadata: { openApiTags: ["Orders"] } as const,
  },
  adminGetOrder: {
    method: "GET",
    path: "/v1/admin/orders/:orderId",
    pathParams: z.object({ orderId: z.string().uuid() }),
    responses: {
      200: adminOrderDetailSchema,
      404: apiError,
    },
    metadata: { openApiTags: ["Orders Admin"] } as const,
  },
  adminListOrders: {
    method: "GET",
    path: "/v1/admin/orders",
    query: adminListOrdersQuerySchema,
    responses: {
      200: adminOrderListSchema,
    },
    metadata: { openApiTags: ["Orders Admin"] } as const,
  },
  adminShipOrder: {
    method: "PATCH",
    path: "/v1/admin/orders/:orderId/ship",
    pathParams: z.object({ orderId: z.string().uuid() }),
    body: shipOrderBodySchema,
    responses: {
      200: adminOrderDetailSchema,
      400: apiError,
      404: apiError,
    },
    metadata: { openApiTags: ["Orders Admin"] } as const,
  },
  adminRefundOrder: {
    method: "POST",
    path: "/v1/admin/orders/:orderId/refund",
    pathParams: z.object({ orderId: z.string().uuid() }),
    body: z.object({}),
    responses: {
      200: adminOrderDetailSchema,
      400: apiError,
      404: apiError,
      502: apiError,
    },
    metadata: { openApiTags: ["Orders Admin"] } as const,
  },
  adminCollectOrder: {
    method: "POST",
    path: "/v1/admin/orders/:orderId/collect",
    pathParams: z.object({ orderId: z.string().uuid() }),
    body: z.object({}),
    responses: {
      200: adminOrderDetailSchema,
      400: apiError,
      404: apiError,
    },
    metadata: { openApiTags: ["Orders Admin"] } as const,
  },
  adminUpdateShippingAddress: {
    method: "PATCH",
    path: "/v1/admin/orders/:orderId/shipping-address",
    pathParams: z.object({ orderId: z.string().uuid() }),
    body: updateShippingAddressBodySchema,
    responses: {
      200: adminOrderDetailSchema,
      404: apiError,
    },
    metadata: { openApiTags: ["Orders Admin"] } as const,
  },
});
