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
  fulfillmentType: "shipping" as const,
  taxRegistrationConfirmed: true,
  reservationTtlMinutes: 15,
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
        shippingZonesTable: { findFirst: jest.fn().mockResolvedValue({ id: "zone-1" }) },
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
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin([]));
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

    it("clamps the session expiry to Stripe's 30 minute floor when the store's reservation window is shorter", async () => {
      const nowSeconds = 1_700_000_000;
      jest.spyOn(Date, "now").mockReturnValue(nowSeconds * 1000);

      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue({ ...mockStore, reservationTtlMinutes: 15 });
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin([]));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ expires_at: nowSeconds + 30 * 60 }),
      );

      jest.spyOn(Date, "now").mockRestore();
    });

    it("extends the session expiry to match the store's reservation window when it exceeds Stripe's floor", async () => {
      const nowSeconds = 1_700_000_000;
      jest.spyOn(Date, "now").mockReturnValue(nowSeconds * 1000);

      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue({ ...mockStore, reservationTtlMinutes: 45 });
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin([]));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ expires_at: nowSeconds + 45 * 60 }),
      );

      jest.spyOn(Date, "now").mockRestore();
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

    it("throws RpcException when a shipping-fulfillment store has zero shipping zones", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.query.shippingZonesTable.findFirst.mockResolvedValue(undefined);

      await expect(service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL)).rejects.toThrow(
        RpcException,
      );
    });

    it("does not check shipping zones for a pickup-fulfillment store", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue({ ...mockStore, fulfillmentType: "pickup" });
      db.query.shippingZonesTable.findFirst.mockResolvedValue(undefined);
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin([]));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      expect(db.query.shippingZonesTable.findFirst).not.toHaveBeenCalled();
    });

    it("throws RpcException when tax registration has not been confirmed", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue({
        ...mockStore,
        taxRegistrationConfirmed: false,
      });

      await expect(service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL)).rejects.toThrow(
        RpcException,
      );
    });

    it("succeeds for a shipping store with a configured zone and confirmed tax status", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin([]));
      db.update.mockReturnValue(updateChain());

      const result = await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      expect(result.checkoutUrl).toBe(CHECKOUT_URL);
    });

    it("wraps Stripe API errors in RpcException", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin([]));
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

    it("omits shipping_options when the store has no shipping rates configured", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin([]));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      const callArgs = mockSessionsCreate.mock.calls[0][0];
      expect(callArgs.shipping_options).toBeUndefined();
    });

    it("offers every configured rate as a shipping option when no rate is pre-resolved", async () => {
      // The normal case: no storefront collects a country before checkout, so
      // there's never a pre-resolved order.shippingRateId. Stripe's own hosted
      // page collects the country and lets the customer pick from these.
      const rates = [
        { name: "Standard", rateCents: 595, minOrderCents: null, estimatedDays: null },
        { name: "Express", rateCents: 1500, minOrderCents: null, estimatedDays: 2 },
      ];
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin(rates));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      const callArgs = mockSessionsCreate.mock.calls[0][0];
      expect(callArgs.shipping_options).toHaveLength(2);
      expect(callArgs.shipping_options[0].shipping_rate_data).toMatchObject({
        display_name: "Standard",
        fixed_amount: { amount: 595, currency: "usd" },
      });
      expect(callArgs.shipping_options[1].shipping_rate_data).toMatchObject({
        display_name: "Express",
        fixed_amount: { amount: 1500, currency: "usd" },
        delivery_estimate: { maximum: { unit: "business_day", value: 2 } },
      });
    });

    it("prices a rate at 0 when the order subtotal meets its free-shipping threshold", async () => {
      const orderOverThreshold = { ...mockOrder, subtotalCents: 6000 };
      const rates = [
        { name: "Standard", rateCents: 595, minOrderCents: 5000, estimatedDays: null },
      ];
      db.query.ordersTable.findFirst.mockResolvedValue(orderOverThreshold);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin(rates));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      const callArgs = mockSessionsCreate.mock.calls[0][0];
      expect(callArgs.shipping_options[0].shipping_rate_data.fixed_amount).toEqual({
        amount: 0,
        currency: "usd",
      });
    });

    it("charges the full rate when the order subtotal is under the free-shipping threshold", async () => {
      const orderUnderThreshold = { ...mockOrder, subtotalCents: 4000 };
      const rates = [
        { name: "Standard", rateCents: 595, minOrderCents: 5000, estimatedDays: null },
      ];
      db.query.ordersTable.findFirst.mockResolvedValue(orderUnderThreshold);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin(rates));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      const callArgs = mockSessionsCreate.mock.calls[0][0];
      expect(callArgs.shipping_options[0].shipping_rate_data.fixed_amount).toEqual({
        amount: 595,
        currency: "usd",
      });
    });

    it("puts the street on the PaymentIntent, never in our DB", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin([]));
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
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin([]));
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
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin([]));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      expect(mockSessionsCreate.mock.calls[0][0].payment_intent_data.shipping).toBeUndefined();
    });

    it("always asks Stripe to collect a shipping address, even when the caller passes none", async () => {
      // Storefronts don't have their own address form — checkout is a straight
      // redirect to the Stripe session. Without shipping_address_collection, no
      // shipping address is ever captured anywhere, for any order.
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.select
        .mockReturnValueOnce(selectChain(mockOrderItems))
        .mockReturnValueOnce(selectChainWithJoin([]));
      db.update.mockReturnValue(updateChain());

      await service.createIntent(ORDER_ID, SUCCESS_URL, CANCEL_URL);

      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          shipping_address_collection: { allowed_countries: ["US"] },
        }),
      );
    });
  });
});
