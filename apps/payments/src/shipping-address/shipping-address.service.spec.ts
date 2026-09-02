import { ConfigService } from "@nestjs/config";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { Test, TestingModule } from "@nestjs/testing";
import { ShippingAddressService } from "./shipping-address.service";

describe("ShippingAddressService", () => {
  let service: ShippingAddressService;
  let dbFindFirst: jest.Mock;
  let retrieve: jest.Mock;
  let listSessions: jest.Mock;

  beforeEach(async () => {
    dbFindFirst = jest.fn();
    retrieve = jest.fn();
    listSessions = jest.fn().mockResolvedValue({ data: [] });

    const db = {
      query: { ordersTable: { findFirst: dbFindFirst } },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingAddressService,
        { provide: DB_TOKEN, useValue: db },
        { provide: ConfigService, useValue: { getOrThrow: () => "sk_test_dummy" } },
      ],
    }).compile();

    service = module.get(ShippingAddressService);
    (service as any).stripe = {
      paymentIntents: { retrieve },
      checkout: { sessions: { list: listSessions } },
    };
  });

  it("returns the street from the PaymentIntent", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    retrieve.mockResolvedValue({
      shipping: { address: { line1: "12 Baker St", line2: "Flat 4" } },
    });

    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: "12 Baker St",
      line2: "Flat 4",
    });
    expect(listSessions).not.toHaveBeenCalled();
  });

  it("normalizes a missing line2 on the PI to null, not undefined", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    retrieve.mockResolvedValue({ shipping: { address: { line1: "742 Evergreen Terrace" } } });

    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: "742 Evergreen Terrace",
      line2: null,
    });
    expect(listSessions).not.toHaveBeenCalled();
  });

  it("treats a PI whose shipping has no line1 as no street and asks the session", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    // A name-only shipping object: Stripe rejects a partial address on create, but an
    // address can still come back street-less on older intents.
    retrieve.mockResolvedValue({ shipping: { name: "Ada Lovelace", address: { city: "Provo" } } });
    listSessions.mockResolvedValue({
      data: [
        { collected_information: { shipping_details: { address: { line1: "9 Session St" } } } },
      ],
    });

    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: "9 Session St",
      line2: null,
    });
  });

  // Storefronts that redirect straight to Checkout let Stripe's hosted page collect the
  // address; it lands on the session and is never mirrored onto the PaymentIntent.
  it("falls back to the Checkout Session when the PI carries no shipping", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    retrieve.mockResolvedValue({ shipping: null });
    listSessions.mockResolvedValue({
      data: [
        {
          collected_information: {
            shipping_details: { address: { line1: "440 Sansome St", line2: "Suite 200" } },
          },
        },
      ],
    });

    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: "440 Sansome St",
      line2: "Suite 200",
    });
    expect(listSessions).toHaveBeenCalledWith({ payment_intent: "pi_1", limit: 1 });
  });

  it("reads the session's pre-rename shipping_details when collected_information is absent", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    retrieve.mockResolvedValue({ shipping: null });
    listSessions.mockResolvedValue({
      data: [{ shipping_details: { address: { line1: "1 Old Way", line2: null } } }],
    });

    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: "1 Old Way",
      line2: null,
    });
  });

  it("prefers collected_information over the pre-rename field when both are present", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    retrieve.mockResolvedValue({ shipping: null });
    listSessions.mockResolvedValue({
      data: [
        {
          collected_information: {
            shipping_details: { address: { line1: "1 Current Ave", line2: null } },
          },
          shipping_details: { address: { line1: "2 Deprecated Rd", line2: "Unit 9" } },
        },
      ],
    });

    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: "1 Current Ave",
      line2: null,
    });
  });

  it("falls through to the pre-rename field when collected_information holds no address", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    retrieve.mockResolvedValue({ shipping: null });
    listSessions.mockResolvedValue({
      data: [
        {
          collected_information: { shipping_details: null },
          shipping_details: { address: { line1: "2 Deprecated Rd", line2: "Unit 9" } },
        },
      ],
    });

    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: "2 Deprecated Rd",
      line2: "Unit 9",
    });
  });

  it("returns nulls for a legacy order with no shipping on the PI or the session", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_old" });
    retrieve.mockResolvedValue({ shipping: null });
    listSessions.mockResolvedValue({ data: [] });

    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: null,
      line2: null,
    });
  });

  it("returns nulls when the session exists but carries no address at all", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    retrieve.mockResolvedValue({ shipping: null });
    listSessions.mockResolvedValue({ data: [{ collected_information: null }] });

    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: null,
      line2: null,
    });
  });

  it("returns nulls (never throws) when the session lookup fails", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    retrieve.mockResolvedValue({ shipping: null });
    listSessions.mockRejectedValue(new Error("stripe is down"));

    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: null,
      line2: null,
    });
  });

  it("returns nulls (never throws) when Stripe is down — a page must not die over a street", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    retrieve.mockRejectedValue(new Error("stripe is down"));

    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: null,
      line2: null,
    });
    // A failed PI call means Stripe is unreachable — don't burn a second call to prove it.
    expect(listSessions).not.toHaveBeenCalled();
  });

  it("returns nulls when the order has no PaymentIntent at all", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: null });
    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: null,
      line2: null,
    });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("returns nulls (never throws) when the DATABASE is down — a receipt must not be lost", async () => {
    dbFindFirst.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(service.getShippingStreet("order-1")).resolves.toEqual({
      line1: null,
      line2: null,
    });
  });
});
