import { ConfigService } from "@nestjs/config";
import { EasypostService } from "./easypost.service";

const mockClient = {
  user: { createChild: jest.fn() },
  shipment: { create: jest.fn(), buy: jest.fn() },
};

jest.mock("@easypost/api", () => jest.fn(() => mockClient));

function makeService() {
  const config = { getOrThrow: () => "ep_test_key" } as unknown as ConfigService;
  return new EasypostService(config);
}

describe("EasypostService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("provisions a child account and returns its id and api key", async () => {
    mockClient.user.createChild.mockResolvedValue({
      id: "user_1",
      api_keys: [{ key: "ep_child_1" }],
    });
    const service = makeService();

    const result = await service.provisionChildAccount("Camo Merch");

    expect(mockClient.user.createChild).toHaveBeenCalledWith({ name: "Camo Merch" });
    expect(result).toEqual({ childUserId: "user_1", apiKey: "ep_child_1" });
  });

  it("creates a shipment and normalizes rates", async () => {
    mockClient.shipment.create.mockResolvedValue({
      id: "shp_1",
      rates: [
        { id: "rate_1", carrier: "USPS", service: "Priority", rate: "8.42", delivery_days: 2 },
        { id: "rate_2", carrier: "UPS", service: "Ground", rate: "11.10", delivery_days: null },
      ],
    });
    const service = makeService();

    const result = await service.createShipment({
      toAddress: {
        name: "Jamie",
        street1: "1 Main St",
        city: "Provo",
        state: "UT",
        zip: "84601",
        country: "US",
      },
      fromAddress: {
        name: "Store",
        street1: "2 Warehouse Rd",
        city: "Provo",
        state: "UT",
        zip: "84601",
        country: "US",
      },
      parcel: { weightOz: 16, lengthIn: 10, widthIn: 8, heightIn: 4 },
    });

    expect(result.shipmentId).toBe("shp_1");
    expect(result.rates).toEqual([
      {
        rateId: "rate_1",
        carrier: "USPS",
        service: "Priority",
        amountCents: 842,
        estimatedDays: 2,
      },
      {
        rateId: "rate_2",
        carrier: "UPS",
        service: "Ground",
        amountCents: 1110,
        estimatedDays: null,
      },
    ]);
  });

  it("buys a label and returns tracking/label details", async () => {
    mockClient.shipment.buy.mockResolvedValue({
      tracking_code: "9400111",
      postage_label: { label_url: "https://easypost.com/label.png" },
      selected_rate: { carrier: "USPS", service: "Priority", rate: "8.42" },
    });
    const service = makeService();

    const result = await service.buyLabel("shp_1", "rate_1");

    expect(result).toEqual({
      trackingCode: "9400111",
      labelUrl: "https://easypost.com/label.png",
      carrier: "USPS",
      service: "Priority",
      costCents: 842,
    });
  });
});
