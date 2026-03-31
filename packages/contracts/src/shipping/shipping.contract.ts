import { initContract } from "@ts-rest/core";
import {
  apiError,
  createShippingRateSchema,
  createShippingZoneSchema,
  DeleteResponse,
  shippingParams,
  ShippingRateItem,
  shippingRateParam,
  ShippingZoneItem,
  ShippingZoneList,
  shippingZoneParam,
  updateShippingRateSchema,
  updateShippingZoneSchema,
} from "@sitehaus-ecom/validation";

const c = initContract();

export const shippingContract = c.router({
  listZones: {
    method: "GET",
    path: "/v1/admin/shipping/zones",
    responses: {
      200: ShippingZoneList,
      404: apiError,
    },
    metadata: { openApiTags: ["Shipping Zone"] } as const,
  },

  createZone: {
    method: "POST",
    path: "/v1/admin/shipping/zones",
    body: createShippingZoneSchema,
    responses: {
      200: ShippingZoneItem,
      404: apiError,
    },
    metadata: { openApiTags: ["Shipping Zone"] } as const,
  },

  updateZone: {
    method: "PATCH",
    path: "/v1/admin/shipping/zones/:zoneId",
    pathParams: shippingZoneParam,
    body: updateShippingZoneSchema,
    responses: {
      200: ShippingZoneItem,
      404: apiError,
    },
    metadata: { openApiTags: ["Shipping Zone"] } as const,
  },

  deleteZone: {
    method: "DELETE",
    path: "/v1/admin/shipping/zones/:zoneId",
    pathParams: shippingZoneParam,
    responses: {
      200: DeleteResponse,
      404: apiError,
    },
    metadata: { openApiTags: ["Shipping Zone"] } as const,
  },

  createRate: {
    method: "POST",
    path: "/v1/admin/shipping/zones/:zoneId/rates",
    pathParams: shippingZoneParam,
    body: createShippingRateSchema,
    responses: {
      200: ShippingRateItem,
      404: apiError,
    },
    metadata: { openApiTags: ["Shipping Rate"] } as const,
  },

  updateRate: {
    method: "PATCH",
    path: "/v1/admin/shipping/zones/:zoneId/rates/:rateId",
    pathParams: shippingParams,
    body: updateShippingRateSchema,
    responses: {
      200: ShippingRateItem,
      404: apiError,
    },
    metadata: { openApiTags: ["Shipping Rate"] } as const,
  },

  deleteRate: {
    method: "DELETE",
    path: "/v1/admin/shipping/zones/:zoneId/rates/:rateId",
    pathParams: shippingRateParam,
    body: createShippingRateSchema,
    responses: {
      200: ShippingRateItem,
      404: apiError,
    },
    metadata: { openApiTags: ["Shipping Rate"] } as const,
  },
});
