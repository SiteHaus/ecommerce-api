import { ConfigService } from "@nestjs/config";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { Test, TestingModule } from "@nestjs/testing";
import { ShippingAddressService } from "./shipping-address.service";

describe("ShippingAddressService", () => {
  let service: ShippingAddressService;
  let dbFindFirst: jest.Mock;
  let list: jest.Mock;

  beforeEach(async () => {
    dbFindFirst = jest.fn();
    list = jest.fn();

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
    (service as any).stripe = { checkout: { sessions: { list } } };
  });

  it("looks up the Checkout Session by payment_intent, not the PaymentIntent itself", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    list.mockResolvedValue({ data: [{ shipping_details: null }] });

    await service.getShippingAddress("order-1");

    expect(list).toHaveBeenCalledWith({ payment_intent: "pi_1", limit: 1 });
  });

  it("returns the whole address from shipping_details (pre-basil shape)", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    list.mockResolvedValue({
      data: [
        {
          shipping_details: {
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
        },
      ],
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

  it("returns the whole address from collected_information.shipping_details (basil+ shape), preferred over the old field", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_1" });
    list.mockResolvedValue({
      data: [
        {
          shipping_details: null,
          collected_information: {
            shipping_details: {
              name: "Grace Hopper",
              address: {
                line1: "1 Analytical Way",
                line2: null,
                city: "Arlington",
                state: "VA",
                postal_code: "22201",
                country: "US",
              },
            },
          },
        },
      ],
    });

    await expect(service.getShippingAddress("order-1")).resolves.toEqual({
      line1: "1 Analytical Way",
      line2: null,
      name: "Grace Hopper",
      city: "Arlington",
      state: "VA",
      zip: "22201",
      country: "US",
    });
  });

  it("returns nulls when no Checkout Session collected shipping", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_old" });
    list.mockResolvedValue({ data: [{ shipping_details: null }] });

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

  it("returns nulls when no Checkout Session is found for the PaymentIntent at all", async () => {
    dbFindFirst.mockResolvedValue({ stripePaymentIntentId: "pi_orphan" });
    list.mockResolvedValue({ data: [] });

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
    list.mockRejectedValue(new Error("stripe is down"));

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
    expect(list).not.toHaveBeenCalled();
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
