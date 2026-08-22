import { EasypostTrackingService } from "./easypost-tracking.service";

describe("EasypostTrackingService.handle", () => {
  it("resolves the order by easypost_shipment_id and logs it", async () => {
    const db = {
      query: { ordersTable: { findFirst: jest.fn().mockResolvedValue({ id: "order-1" }) } },
    };
    const service = new EasypostTrackingService(db as any);

    const result = await service.handle({
      shipmentId: "shp_1",
      trackingCode: "9400",
      status: "in_transit",
      rawEvent: {},
    });

    expect(result).toEqual({ orderId: "order-1", handled: true });
  });

  it("logs and drops an event for an unknown shipment id — never throws", async () => {
    const db = { query: { ordersTable: { findFirst: jest.fn().mockResolvedValue(undefined) } } };
    const service = new EasypostTrackingService(db as any);

    const result = await service.handle({
      shipmentId: "shp_unknown",
      trackingCode: "9400",
      status: "in_transit",
      rawEvent: {},
    });

    expect(result).toEqual({ orderId: null, handled: false });
  });
});
