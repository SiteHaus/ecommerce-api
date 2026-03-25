import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { IntentService } from "./intent.service";

const ORDER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const STORE_ID = "aaaaaaaa-0000-0000-0000-000000000002";
const STRIPE_ACCOUNT_ID = "acct_test123";
const CLIENT_SECRET = "pi_test_secret_abc";
const INTENT_ID = "pi_test123";

const mockOrder = {
  id: ORDER_ID,
  storeId: STORE_ID,
  totalCents: 5000,
  currency: "usd",
};

const mockStore = {
  stripeAccountId: STRIPE_ACCOUNT_ID,
  stripeChargesEnabled: true,
  currency: "usd",
};

const mockIntent = {
  id: INTENT_ID,
  client_secret: CLIENT_SECRET,
};

// ── helpers ───────────────────────────────────────────────────────────────────

function updateChain() {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  };
}

describe("IntentService", () => {
  let service: IntentService;
  let db: any;
  let mockStripeCreate: jest.Mock;

  beforeEach(async () => {
    mockStripeCreate = jest.fn().mockResolvedValue(mockIntent);

    db = {
      query: {
        ordersTable: { findFirst: jest.fn() },
        storesTable: { findFirst: jest.fn() },
      },
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentService,
        { provide: DB_TOKEN, useValue: db },
        { provide: ConfigService, useValue: { getOrThrow: () => "sk_test_dummy" } },
      ],
    }).compile();

    service = module.get(IntentService);

    // Stub out the Stripe instance after construction
    (service as any).stripe = {
      paymentIntents: { create: mockStripeCreate },
    };
  });

  describe("createIntent", () => {
    it("creates a Stripe PaymentIntent, stores the ID, and returns clientSecret", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.update.mockReturnValue(updateChain());

      const result = await service.createIntent(ORDER_ID);

      expect(result.clientSecret).toBe(CLIENT_SECRET);
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: "usd",
          transfer_data: { destination: STRIPE_ACCOUNT_ID },
          metadata: expect.objectContaining({ orderId: ORDER_ID }),
        }),
      );
      expect(db.update).toHaveBeenCalled();
    });

    it("throws RpcException when order is not found", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(null);
      await expect(service.createIntent(ORDER_ID)).rejects.toThrow(RpcException);
    });

    it("throws RpcException when store has no Stripe account", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue({
        ...mockStore,
        stripeAccountId: null,
      });
      await expect(service.createIntent(ORDER_ID)).rejects.toThrow(RpcException);
    });

    it("throws RpcException when store charges are not enabled", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue({
        ...mockStore,
        stripeChargesEnabled: false,
      });
      await expect(service.createIntent(ORDER_ID)).rejects.toThrow(RpcException);
    });

    it("wraps Stripe API errors in RpcException", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      mockStripeCreate.mockRejectedValue(new Error("Your card was declined"));

      await expect(service.createIntent(ORDER_ID)).rejects.toThrow(RpcException);
    });
  });
});
