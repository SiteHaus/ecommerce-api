import { ConfigService } from "@nestjs/config";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { Test, TestingModule } from "@nestjs/testing";
import { ShippingAddressService } from "./shipping-address.service";

describe("ShippingAddressService", () => {
  let service: ShippingAddressService;
  let dbFindFirst: jest.Mock;
  let retrieve: jest.Mock;

  beforeEach(async () => {
    dbFindFirst = jest.fn();
    retrieve = jest.fn();

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
    (service as any).stripe = { paymentIntents: { retrieve } };
  });

  it("returns the whole address from the PaymentIntent, not just the street", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    retrieve.mockResolvedValue({
      shipping: {
        name: "Ada Lovelace",
        address: {
          line1: "12 Baker St",
          line2: "Flat 4",
          city: "Roy",
          state: "UT",
          postal_code: "84067",
          country: "US",
        },
      },
    });

    await expect(service.getShippingAddress("order-1")).resolves.toEqual({
      line1: "12 Baker St",
      line2: "Flat 4",
      name: "Ada Lovelace",
      city: "Roy",
      state: "UT",
      zip: "84067",
      country: "US",
    });
  });

  it("returns nulls for a legacy order whose PI has no shipping", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_old" });
    retrieve.mockResolvedValue({ shipping: null });

    await expect(service.getShippingAddress("order-1")).resolves.toEqual({
      line1: null,
      line2: null,
      name: null,
      city: null,
      state: null,
      zip: null,
      country: null,
    });
  });

  it("returns nulls (never throws) when Stripe is down — a page must not die over a street", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    retrieve.mockRejectedValue(new Error("stripe is down"));

    await expect(service.getShippingAddress("order-1")).resolves.toEqual({
      line1: null,
      line2: null,
      name: null,
      city: null,
      state: null,
      zip: null,
      country: null,
    });
  });

  it("returns nulls when the order has no PaymentIntent at all", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: null });
    await expect(service.getShippingAddress("order-1")).resolves.toEqual({
      line1: null,
      line2: null,
      name: null,
      city: null,
      state: null,
      zip: null,
      country: null,
    });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("returns nulls (never throws) when the DATABASE is down — a receipt must not be lost", async () => {
    dbFindFirst.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(service.getShippingAddress("order-1")).resolves.toEqual({
      line1: null,
      line2: null,
      name: null,
      city: null,
      state: null,
      zip: null,
      country: null,
    });
  });
});
