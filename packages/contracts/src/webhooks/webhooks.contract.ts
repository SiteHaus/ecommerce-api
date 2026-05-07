import {
  apiError,
  createWebhookEndpointSchema,
  updateWebhookEndpointSchema,
  webhookDeliverySchema,
  webhookEndpointSchema,
  webhookEndpointWithSecretSchema,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const webhooksContract = c.router({
  adminListEndpoints: {
    method: "GET",
    path: "/v1/admin/webhooks",
    responses: {
      200: z.array(webhookEndpointSchema),
    },
    metadata: { openApiTags: ["Webhooks Admin"] } as const,
  },
  adminCreateEndpoint: {
    method: "POST",
    path: "/v1/admin/webhooks",
    body: createWebhookEndpointSchema,
    responses: {
      201: webhookEndpointWithSecretSchema,
      400: apiError,
    },
    metadata: { openApiTags: ["Webhooks Admin"] } as const,
  },
  adminUpdateEndpoint: {
    method: "PATCH",
    path: "/v1/admin/webhooks/:endpointId",
    pathParams: z.object({ endpointId: z.string().uuid() }),
    body: updateWebhookEndpointSchema,
    responses: {
      200: webhookEndpointSchema,
      404: apiError,
    },
    metadata: { openApiTags: ["Webhooks Admin"] } as const,
  },
  adminDeleteEndpoint: {
    method: "DELETE",
    path: "/v1/admin/webhooks/:endpointId",
    pathParams: z.object({ endpointId: z.string().uuid() }),
    body: z.object({}),
    responses: {
      204: z.object({}),
      404: apiError,
    },
    metadata: { openApiTags: ["Webhooks Admin"] } as const,
  },
  adminListDeliveries: {
    method: "GET",
    path: "/v1/admin/webhooks/:endpointId/deliveries",
    pathParams: z.object({ endpointId: z.string().uuid() }),
    responses: {
      200: z.array(webhookDeliverySchema),
      404: apiError,
    },
    metadata: { openApiTags: ["Webhooks Admin"] } as const,
  },
});
