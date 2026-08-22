import { of } from "rxjs";
import { LabelPurchaseService } from "./label-purchase.service";

function baseDeps(overrides: Partial<any> = {}) {
  return {
    db: {
      query: {
        ordersTable: { findFirst: jest.fn() },
        storesTable: { findFirst: jest.fn() },
      },
      select: jest.fn(),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }),
      }),
    },
    easypost: { createShipment: jest.fn(), buyLabel: jest.fn() },
    ledger: { availableToSpendCents: jest.fn().mockResolvedValue(7500), recordCharge: jest.fn() },
    payments: { send: jest.fn().mockReturnValue(of({ line1: "1 Main St", line2: null })) },
    ...overrides,
  };
}

describe("LabelPurchaseService.getRates", () => {
  it("reports missing weights instead of calling EasyPost", async () => {
    const deps = baseDeps();
    deps.db.query.ordersTable.findFirst.mockResolvedValue({
      id: "order-1",
      storeId: "store-1",
      shippingName: "Jamie",
      shippingCity: "Provo",
      shippingState: "UT",
      shippingZip: "84601",
      shippingCountry: "US",
    });
    deps.db.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest
            .fn()
            .mockResolvedValue([
              { variantId: "v1", variantName: "Small", weightGrams: null, quantity: 1 },
            ]),
        }),
      }),
    });

    const service = new LabelPurchaseService(
      deps.db as any,
      deps.easypost as any,
      deps.ledger as any,
      deps.payments as any,
    );
    const result = await service.getRates("order-1");

    expect(result).toEqual({
      error: "missing_weight",
      variants: [{ variantId: "v1", variantName: "Small" }],
    });
    expect(deps.easypost.createShipment).not.toHaveBeenCalled();
  });

  it("blocks rate lookup when the store has no postage budget left", async () => {
    const deps = baseDeps();
    deps.ledger.availableToSpendCents.mockResolvedValue(0);
    deps.db.query.ordersTable.findFirst.mockResolvedValue({
      id: "order-1",
      storeId: "store-1",
      shippingCity: "Provo",
      shippingState: "UT",
      shippingZip: "84601",
      shippingCountry: "US",
    });
    deps.db.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest
            .fn()
            .mockResolvedValue([
              { variantId: "v1", variantName: "Small", weightGrams: 200, quantity: 1 },
            ]),
        }),
      }),
    });

    const service = new LabelPurchaseService(
      deps.db as any,
      deps.easypost as any,
      deps.ledger as any,
      deps.payments as any,
    );
    const result = await service.getRates("order-1");

    expect(result).toEqual({ error: "billing_blocked" });
    expect(deps.easypost.createShipment).not.toHaveBeenCalled();
  });

  it("returns every rate EasyPost offers, not just the cheapest or first one", async () => {
    const deps = baseDeps();
    deps.db.query.ordersTable.findFirst.mockResolvedValue({
      id: "order-1",
      storeId: "store-1",
      shippingCity: "Provo",
      shippingState: "UT",
      shippingZip: "84601",
      shippingCountry: "US",
    });
    deps.db.query.storesTable.findFirst.mockResolvedValue({
      id: "store-1",
      originLine1: "2 Warehouse Rd",
    });
    deps.db.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest
            .fn()
            .mockResolvedValue([
              { variantId: "v1", variantName: "Small", weightGrams: 200, quantity: 1 },
            ]),
        }),
      }),
    });
    deps.easypost.createShipment.mockResolvedValue({
      shipmentId: "shp_1",
      rates: [
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
      ],
    });

    const service = new LabelPurchaseService(
      deps.db as any,
      deps.easypost as any,
      deps.ledger as any,
      deps.payments as any,
    );
    const result = await service.getRates("order-1");

    expect(result).toEqual({
      shipmentId: "shp_1",
      rates: [
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
      ],
    });
  });
});

describe("LabelPurchaseService.buyLabel", () => {
  it("buys the specific rate the merchant picked, records the ledger charge, and ships the order", async () => {
    const deps = baseDeps();
    deps.easypost.buyLabel.mockResolvedValue({
      trackingCode: "9400111",
      labelUrl: "https://easypost.com/label.png",
      carrier: "USPS",
      service: "Priority",
      costCents: 842,
    });
    deps.db.query.ordersTable.findFirst.mockResolvedValue({ id: "order-1", storeId: "store-1" });

    const service = new LabelPurchaseService(
      deps.db as any,
      deps.easypost as any,
      deps.ledger as any,
      deps.payments as any,
    );
    const result = await service.buyLabel({
      orderId: "order-1",
      shipmentId: "shp_1",
      rateId: "rate_1",
    });

    expect(deps.easypost.buyLabel).toHaveBeenCalledWith("shp_1", "rate_1");
    expect(deps.ledger.recordCharge).toHaveBeenCalledWith("store-1", "order-1", "shp_1", 842);
    expect(result).toEqual({
      orderId: "order-1",
      carrier: "USPS",
      service: "Priority",
      trackingCode: "9400111",
      labelUrl: "https://easypost.com/label.png",
    });
  });

  it("blocks the buy step too — a store can go over budget between getRates and buyLabel", async () => {
    const deps = baseDeps();
    deps.ledger.availableToSpendCents.mockResolvedValue(0);
    deps.db.query.ordersTable.findFirst.mockResolvedValue({ id: "order-1", storeId: "store-1" });

    const service = new LabelPurchaseService(
      deps.db as any,
      deps.easypost as any,
      deps.ledger as any,
      deps.payments as any,
    );
    const result = await service.buyLabel({
      orderId: "order-1",
      shipmentId: "shp_1",
      rateId: "rate_1",
    });

    expect(result).toEqual({ error: "billing_blocked" });
    expect(deps.easypost.buyLabel).not.toHaveBeenCalled();
  });
});
