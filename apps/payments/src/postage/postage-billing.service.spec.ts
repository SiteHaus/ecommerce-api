import { ConfigService } from "@nestjs/config";
import { PostageBillingService } from "./postage-billing.service";

const mockStripe = {
  customers: { retrieve: jest.fn(), update: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  paymentIntents: { create: jest.fn() },
};

jest.mock("stripe", () => jest.fn(() => mockStripe));

const originalFetch = global.fetch;

function makeService(db: any) {
  const config = {
    getOrThrow: (k: string) => {
      if (k === "STRIPE_SECRET_KEY") return "sk_test_x";
      if (k === "API_URL") return "https://api.sitehaus.dev";
      if (k === "COMMERCE_SERVICE_KEY") return "shared-secret";
      return "x";
    },
  } as unknown as ConfigService;
  return new PostageBillingService(config, db);
}

describe("PostageBillingService.getBillingSetup", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("uses the cached stripeBillingCustomerId and reports a default payment method as present", async () => {
    const db = {
      query: {
        storesTable: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: "s1", clientId: "c1", stripeBillingCustomerId: "cus_1" }),
        },
      },
      update: jest.fn(),
    };
    global.fetch = jest.fn();
    mockStripe.customers.retrieve.mockResolvedValue({
      id: "cus_1",
      invoice_settings: { default_payment_method: "pm_1" },
    });

    const service = makeService(db);
    const result = await service.getBillingSetup("s1");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result?.stripeCustomerId).toBe("cus_1");
    expect(result?.hasDefaultPaymentMethod).toBe(true);
    expect(result?.setupUrl).toBeUndefined();
  });

  it("fetches and caches the Stripe customer from apps/api when nothing is cached yet", async () => {
    const db = {
      query: {
        storesTable: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: "s1", clientId: "c1", stripeBillingCustomerId: null }),
        },
      },
      update: jest
        .fn()
        .mockReturnValue({
          set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }),
        }),
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stripeCustomerId: "cus_new" }),
    });
    mockStripe.customers.retrieve.mockResolvedValue({
      id: "cus_new",
      invoice_settings: { default_payment_method: "pm_1" },
    });

    const service = makeService(db);
    const result = await service.getBillingSetup("s1");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.sitehaus.dev/clients/c1/billing/stripe-customer",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-service-key": "shared-secret" }),
      }),
    );
    expect(db.update).toHaveBeenCalled();
    expect(result?.stripeCustomerId).toBe("cus_new");
  });

  it("returns a setup-mode Checkout URL when there is no default payment method yet", async () => {
    const db = {
      query: {
        storesTable: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: "s1", clientId: "c1", stripeBillingCustomerId: "cus_1" }),
        },
      },
      update: jest.fn(),
    };
    global.fetch = jest.fn();
    mockStripe.customers.retrieve.mockResolvedValue({
      id: "cus_1",
      invoice_settings: { default_payment_method: null },
    });
    mockStripe.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/setup/xyz",
    });

    const service = makeService(db);
    const result = await service.getBillingSetup("s1");

    expect(result?.hasDefaultPaymentMethod).toBe(false);
    expect(result?.setupUrl).toBe("https://checkout.stripe.com/setup/xyz");
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "setup", customer: "cus_1" }),
    );
  });
});
