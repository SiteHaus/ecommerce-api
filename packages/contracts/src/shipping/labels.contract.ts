import { initContract } from "@ts-rest/core";
import {
  apiError,
  BuyLabelError,
  BuyLabelResponse,
  buyLabelSchema,
  createParcelPresetSchema,
  DeleteResponse,
  GetRatesError,
  GetRatesResponse,
  getRatesSchema,
  LedgerList,
  OriginAddress,
  ParcelPresetItem,
  ParcelPresetList,
  PostageBalance,
  setOriginAddressSchema,
} from "@sitehaus-ecom/validation";

const c = initContract();

export const labelsContract = c.router({
  getOriginAddress: {
    method: "GET",
    path: "/v1/admin/shipping/origin",
    responses: { 200: OriginAddress, 404: apiError },
    metadata: { openApiTags: ["Labels"] } as const,
  },
  setOriginAddress: {
    method: "PUT",
    path: "/v1/admin/shipping/origin",
    body: setOriginAddressSchema,
    responses: { 200: OriginAddress, 404: apiError },
    metadata: { openApiTags: ["Labels"] } as const,
  },
  listPresets: {
    method: "GET",
    path: "/v1/admin/shipping/presets",
    responses: { 200: ParcelPresetList, 404: apiError },
    metadata: { openApiTags: ["Labels"] } as const,
  },
  createPreset: {
    method: "POST",
    path: "/v1/admin/shipping/presets",
    body: createParcelPresetSchema,
    responses: { 200: ParcelPresetItem, 404: apiError },
    metadata: { openApiTags: ["Labels"] } as const,
  },
  deletePreset: {
    method: "DELETE",
    path: "/v1/admin/shipping/presets/:presetId",
    responses: { 200: DeleteResponse, 404: apiError },
    metadata: { openApiTags: ["Labels"] } as const,
  },
  getRates: {
    method: "POST",
    path: "/v1/admin/orders/:orderId/label/rates",
    body: getRatesSchema,
    responses: { 200: GetRatesResponse, 400: GetRatesError, 404: apiError },
    metadata: { openApiTags: ["Labels"] } as const,
  },
  buyLabel: {
    method: "POST",
    path: "/v1/admin/orders/:orderId/label",
    body: buyLabelSchema,
    responses: { 200: BuyLabelResponse, 400: BuyLabelError, 404: apiError },
    metadata: { openApiTags: ["Labels"] } as const,
  },
  getPostageBalance: {
    method: "GET",
    path: "/v1/admin/shipping/postage/balance",
    responses: { 200: PostageBalance, 404: apiError },
    metadata: { openApiTags: ["Labels"] } as const,
  },
  listLedger: {
    method: "GET",
    path: "/v1/admin/shipping/postage/ledger",
    responses: { 200: LedgerList, 404: apiError },
    metadata: { openApiTags: ["Labels"] } as const,
  },
});
