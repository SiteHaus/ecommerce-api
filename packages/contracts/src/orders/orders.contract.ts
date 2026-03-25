import {
  adminListOrdersQuerySchema,
  adminOrderDetailSchema,
  adminOrderListSchema,
  apiError,
  getOrderQuerySchema,
  listOrdersQuerySchema,
  orderDetailSchema,
  orderListSchema,
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
});
