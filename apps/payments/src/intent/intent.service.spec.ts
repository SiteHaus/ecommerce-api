import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { IntentService } from "./intent.service";

const ORDER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const STORE_ID = "aaaaaaaa-0000-4000-8000-000000000002";
const RATE_ID = "aaaaaaaa-0000-4000-8000-000000000003";
const STRIPE_ACCOUNT_ID = "acct_test123";
const CHECKOUT_URL = "https://checkout.stripe.com/pay/test_session_xyz";
const SUCCESS_URL = "https://example.com/success";
const CANCEL_URL = "https://example.com/cancel";

const mockOrder = {
  id: ORDER_ID,
  storeId: STORE_ID,
  email: "customer@example.com",
  currency: "usd",
  shippingRateId: null,
  shippingCents: 0,
};

const mockStore = {
  stripeAccountId: STRIPE_ACCOUNT_ID,
  stripeChargesEnabled: true,
  currency: "usd",
};

const mockSession = {
  id: "cs_test123",
  url: CHECKOUT_URL,
};

const mockOrderItems = [
  {
    productName: "Vitamin C",
    variantName: "90 Capsules",
    sku: "VIT-C-90",
    unitPriceCents: 2500,
    quantity: 2,
  },
];

function updateChain() {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  };
}

function selectChain(rows: any[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(rows),
    }),
  };
}

function selectChainWithJoin(rows: any[]) {
  const chain: any = {
    from: jest.fn(),
    innerJoin: jest.fn(),
    where: jest.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  return chain;
}

describe("IntentService", () => {
  let service: IntentService;
  let db: any;
  let mockSessionsCreate: jest.Mock;

  beforeEach(() => {
    mockSessionsCreate = jest.fn().mockResolvedValue(mockSession);

    db = {
      query: {
        ordersTable: { findFirst: jest.fn() },
        storesTable: { findFirst: jest.fn() },
      },
      select: jest.fn(),
      update: jest.fn(),
    };

    service = new (IntentService as any)(
      { getOrThrow: () => "sk_test_dummy" } as unknown as ConfigService,
      db,
    );

    (service as any).stripe = {
      checkout: { sessions: { create: mockSessionsCreate } },
    };
  });

  describe("createIntent", () => {
    it("creates a Stripe Checkout Session and returns checkoutUrl", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select.mockReturnValue(selectChain(mockOrderItems));
      db.update.mockReturnValue(updateChain());

      const result = await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      expect(result.checkoutUrl).toBe(CHECKOUT_URL);
      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          success_url: `${SUCCESS_URL}?orderId=${ORDER_ID}`,
          cancel_url: CANCEL_URL,
          metadata: expect.objectContaining({ orderId: ORDER_ID }),
        }),
      );
      expect(db.update).toHaveBeenCalled();
    });

    it("throws RpcException when order is not found", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(null);
      await expect(service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL)).rejects.toThrow(
        RpcException,
      );
    });

    it("throws RpcException when store has no Stripe account", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue({ ...mockStore, stripeAccountId: null });
      db.select.mockReturnValue(selectChain(mockOrderItems));
      await expect(service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL)).rejects.toThrow(
        RpcException,
      );
    });

    it("throws RpcException when store charges are not enabled", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue({
        ...mockStore,
        stripeChargesEnabled: false,
      });
      db.select.mockReturnValue(selectChain(mockOrderItems));
      await expect(service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL)).rejects.toThrow(
        RpcException,
      );
    });

    it("wraps Stripe API errors in RpcException", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select.mockReturnValue(selectChain(mockOrderItems));
      mockSessionsCreate.mockRejectedValue(new Error("Your card was declined"));

      await expect(service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL)).rejects.toThrow(
        RpcException,
      );
    });

    it("passes shipping_options to Stripe when order has a shipping rate", async () => {
      const orderWithRate = { ...mockOrder, shippingRateId: RATE_ID, shippingCents: 1500 };
      const mockRate = { name: "Standard Shipping", estimatedDays: 5 };

      db.query.ordersTable.findFirst.mockResolvedValue(orderWithRate);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChain([mockRate]));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          shipping_options: [
            expect.objectContaining({
              shipping_rate_data: expect.objectContaining({
                type: "fixed_amount",
                fixed_amount: { amount: 1500, currency: "usd" },
                display_name: "Standard Shipping",
              }),
            }),
          ],
        }),
      );
    });

    it("omits shipping_options when order has no shipping rate", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select.mockReturnValue(selectChain(mockOrderItems));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      const callArgs = mockSessionsCreate.mock.calls[0][0];
      expect(callArgs.shipping_options).toBeUndefined();
    });

    it("puts the street on the PaymentIntent, never in our DB", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select.mockReturnValue(selectChain(mockOrderItems));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL, undefined, null, {
        name: "Ada Lovelace",
        line1: "12 Baker St",
        line2: "Flat 4",
        city: "Provo",
        state: "UT",
        zip: "84604",
        country: "US",
      });

      const params = mockSessionsCreate.mock.calls[0][0];
      expect(params.payment_intent_data.shipping).toEqual({
        name: "Ada Lovelace",
        address: {
          line1: "12 Baker St",
          line2: "Flat 4",
          city: "Provo",
          state: "UT",
          postal_code: "84604",
          country: "US",
        },
      });
    });

    it("omits shipping when there is no line1 — Stripe rejects a partial address", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select.mockReturnValue(selectChain(mockOrderItems));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL, undefined, null, {
        name: "Ada Lovelace",
        city: "Provo",
      });

      expect(mockSessionsCreate.mock.calls[0][0].payment_intent_data.shipping).toBeUndefined();
    });

    it("omits shipping entirely when the caller passes none (legacy callers)", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select.mockReturnValue(selectChain(mockOrderItems));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      expect(mockSessionsCreate.mock.calls[0][0].payment_intent_data.shipping).toBeUndefined();
    });
  });
});
