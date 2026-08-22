import { of } from "rxjs";
import { LabelPurchaseService } from "./label-purchase.service";
import { OriginAddressService } from "./origin-address.service";

const FULL_ORIGIN = {
  originName: "Acme",
  originLine1: "2 Warehouse Rd",
  originLine2: null,
  originCity: "Provo",
  originState: "UT",
  originZip: "84601",
  originCountry: "US",
};

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
    easypost: {
      createShipment: jest.fn(),
      buyLabel: jest.fn(),
      provisionChildAccount: jest.fn(),
    },
    ledger: { availableToSpendCents: jest.fn().mockResolvedValue(7500), recordCharge: jest.fn() },
    payments: { send: jest.fn().mockReturnValue(of({ line1: "1 Main St", line2: null })) },
    // `hasOrigin` is a pure predicate, so the real service is used here rather
    // than a stub — a test asserting `origin_required` should exercise the same
    // completeness rule production does, not a hand-written `true`/`false`.
    originAddress: new OriginAddressService(null as any),
    ...overrides,
  };
}

function makeService(deps: ReturnType<typeof baseDeps>) {
  return new LabelPurchaseService(
    deps.db as any,
    deps.easypost as any,
    deps.ledger as any,
    deps.originAddress as any,
    deps.payments as any,
  );
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

    const service = makeService(deps);
    const result = await service.getRates("order-1", "store-1");

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

    const service = makeService(deps);
    const result = await service.getRates("order-1", "store-1");

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
    deps.db.query.storesTable.findFirst.mockResolvedValue({ id: "store-1", ...FULL_ORIGIN });
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

    const service = makeService(deps);
    const result = await service.getRates("order-1", "store-1");

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

  it("refuses another store's order — a foreign orderId is not_found, never quoted", async () => {
    const deps = baseDeps();
    // The order exists, but it belongs to store-2 while store-1 is asking.
    deps.db.query.ordersTable.findFirst.mockResolvedValue({ id: "order-1", storeId: "store-2" });

    const service = makeService(deps);
    const result = await service.getRates("order-1", "store-1");

    expect(result).toEqual({ error: "not_found" });
    // Nothing about the foreign order is touched: no line items read, no rates quoted.
    expect(deps.db.select).not.toHaveBeenCalled();
    expect(deps.easypost.createShipment).not.toHaveBeenCalled();
  });

  it("reports origin_required rather than handing EasyPost a blank from-address", async () => {
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
      originName: null,
      originLine1: null,
      originLine2: null,
      originCity: null,
      originState: null,
      originZip: null,
      originCountry: null,
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

    const service = makeService(deps);
    const result = await service.getRates("order-1", "store-1");

    expect(result).toEqual({ error: "origin_required" });
    expect(deps.easypost.createShipment).not.toHaveBeenCalled();
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

    const service = makeService(deps);
    const result = await service.buyLabel({
      orderId: "order-1",
      storeId: "store-1",
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

    const service = makeService(deps);
    const result = await service.buyLabel({
      orderId: "order-1",
      storeId: "store-1",
      shipmentId: "shp_1",
      rateId: "rate_1",
    });

    expect(result).toEqual({ error: "billing_blocked" });
    expect(deps.easypost.buyLabel).not.toHaveBeenCalled();
  });

  it("refuses another store's order — never buys, charges, or ships against it", async () => {
    const deps = baseDeps();
    deps.db.query.ordersTable.findFirst.mockResolvedValue({ id: "order-1", storeId: "store-2" });

    const service = makeService(deps);
    const result = await service.buyLabel({
      orderId: "order-1",
      storeId: "store-1",
      shipmentId: "shp_1",
      rateId: "rate_1",
    });

    expect(result).toEqual({ error: "not_found" });
    expect(deps.easypost.buyLabel).not.toHaveBeenCalled();
    expect(deps.ledger.recordCharge).not.toHaveBeenCalled();
    expect(deps.db.update).not.toHaveBeenCalled();
  });

  it("maps an EasyPost purchase failure to rate_expired, not an unhandled throw", async () => {
    const deps = baseDeps();
    deps.db.query.ordersTable.findFirst.mockResolvedValue({ id: "order-1", storeId: "store-1" });
    deps.easypost.buyLabel.mockRejectedValue(new Error("Rate is no longer available"));

    const service = makeService(deps);
    const result = await service.buyLabel({
      orderId: "order-1",
      storeId: "store-1",
      shipmentId: "shp_1",
      rateId: "rate_1",
    });

    expect(result).toEqual({ error: "rate_expired" });
    // Nothing was bought, so nothing may be charged or marked shipped.
    expect(deps.ledger.recordCharge).not.toHaveBeenCalled();
    expect(deps.db.update).not.toHaveBeenCalled();
  });
});

describe("LabelPurchaseService.ensureEasypostAccount", () => {
  it("does nothing and reports ready when the store already has a child account", async () => {
    const deps = baseDeps();
    deps.db.query.storesTable.findFirst.mockResolvedValue({
      id: "store-1",
      name: "Acme",
      easypostChildUserId: "user_existing",
    });

    const service = makeService(deps);
    const result = await service.ensureEasypostAccount("store-1");

    expect(result).toEqual({ ready: true });
    expect(deps.easypost.provisionChildAccount).not.toHaveBeenCalled();
    expect(deps.db.update).not.toHaveBeenCalled();
  });

  it("provisions a fresh child account when the store doesn't have one yet", async () => {
    const deps = baseDeps();
    deps.db.query.storesTable.findFirst.mockResolvedValue({
      id: "store-1",
      name: "Acme",
      easypostChildUserId: null,
    });
    deps.easypost.provisionChildAccount.mockResolvedValue({
      childUserId: "user_new",
      apiKey: "ek_test_123",
    });

    const service = makeService(deps);
    const result = await service.ensureEasypostAccount("store-1");

    expect(deps.easypost.provisionChildAccount).toHaveBeenCalledWith("Acme");
    expect(deps.db.update).toHaveBeenCalled();
    expect(result).toEqual({ ready: true });
  });

  it("reports not ready when the store doesn't exist", async () => {
    const deps = baseDeps();
    deps.db.query.storesTable.findFirst.mockResolvedValue(undefined);

    const service = makeService(deps);
    const result = await service.ensureEasypostAccount("store-1");

    expect(result).toEqual({ ready: false });
    expect(deps.easypost.provisionChildAccount).not.toHaveBeenCalled();
  });
});
