import {
  apiError,
  checkoutIntentRequestSchema,
  checkoutIntentResponseSchema,
} from "@sitehaus-ecom/validation";
import { initContract } from "@ts-rest/core";

const c = initContract();

export const checkoutContract = c.router({
  createIntent: {
    method: "POST",
    path: "/v1/checkout/intent",
    body: checkoutIntentRequestSchema,
    responses: {
      201: checkoutIntentResponseSchema,
      400: apiError,
      404: apiError,
    },
    metadata: { openApiTags: ["Checkout"] } as const,
  },
});
