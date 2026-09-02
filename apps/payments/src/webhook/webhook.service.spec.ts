import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import Stripe from "stripe";
import { ReservationService } from "./reservation.service";
import { WebhookService } from "./webhook.service";

jest.mock("stripe");
const MockedStripe = Stripe as jest.MockedClass<typeof Stripe>;

const ORDER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const STORE_ID = "aaaaaaaa-0000-4000-8000-000000000002";
const STRIPE_ACCOUNT_ID = "acct_test123";

const mockOrder = {
  id: ORDER_ID,
  storeId: STORE_ID,
  userId: "user-uuid-1",
  status: "pending",
  subtotalCents: 2500,
  shippingCents: 500,
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const CART_ID = "cccccccc-0000-4000-8000-000000000001";

function makeSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    object: "checkout.session",
    metadata: { orderId: ORDER_ID, storeId: STORE_ID, cartId: CART_ID },
    total_details: { amount_tax: 0, amount_discount: 0, amount_shipping: 0 },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

function makeAccount(overrides: Partial<Stripe.Account> = {}): Stripe.Account {
  return {
    object: "account",
    id: STRIPE_ACCOUNT_ID,
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    ...overrides,
  } as unknown as Stripe.Account;
}

function updateChain(returning: any[] = []) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(returning),
      }),
    }),
  };
}

function deleteChain() {
  return {
    where: jest.fn().mockResolvedValue([]),
  };
}

describe("WebhookService", () => {
  let service: WebhookService;
  let db: any;
  let reservations: jest.Mocked<ReservationService>;
  let audit: { log: jest.Mock };
  let notificationsQueue: { add: jest.Mock };
  let webhooksQueue: { add: jest.Mock };
  let mockConstructEvent: jest.Mock;
  let mockUpdateFn: jest.Mock;
  let mockDeleteFn: jest.Mock;

  beforeEach(() => {
    mockConstructEvent = jest.fn();
    MockedStripe.mockImplementation(
      () =>
        ({
          webhooks: { constructEvent: mockConstructEvent },
        }) as any,
    );

    mockUpdateFn = jest.fn();
    mockDeleteFn = jest.fn();

    db = {
      query: {
        ordersTable: { findFirst: jest.fn() },
      },
      update: mockUpdateFn,
      delete: mockDeleteFn,
    };

    reservations = {
      commit: jest.fn().mockResolvedValue(undefined),
      releaseByOrder: jest.fn().mockResolvedValue(undefined),
    } as any;

    audit = { log: jest.fn().mockResolvedValue(undefined) };
    notificationsQueue = { add: jest.fn().mockResolvedValue(undefined) };
    webhooksQueue = { add: jest.fn().mockResolvedValue(undefined) };

    service = new (WebhookService as any)(
      { getOrThrow: (key: string) => (key === "STRIPE_SECRET_KEY" ? "sk_test" : "whsec_test") },
      db,
      reservations,
      audit,
      notificationsQueue,
      webhooksQueue,
    );

    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.clearAllMocks());

  // ─── constructEvent ────────────────────────────────────────────────────────

  describe("constructEvent", () => {
    it("returns the event on valid signature", () => {
      const fakeEvent = { type: "checkout.session.completed" } as Stripe.Event;
      mockConstructEvent.mockReturnValue(fakeEvent);

      const result = service.constructEvent(Buffer.from("body"), "sig");

      expect(result).toBe(fakeEvent);
    });

    it("returns null and logs warning on invalid signature", () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("No signatures found");
      });

      const result = service.constructEvent(Buffer.from("body"), "bad-sig");

      expect(result).toBeNull();
    });
  });

  // ─── checkout.session.completed ───────────────────────────────────────────

  describe("handle — checkout.session.completed", () => {
    it("commits reservations and confirms the order", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockUpdateFn.mockReturnValue(updateChain());
      mockDeleteFn.mockReturnValue(deleteChain());

      await service.handle({
        type: "checkout.session.completed",
        data: { object: makeSession() },
      } as any);

      expect(reservations.commit).toHaveBeenCalledWith(ORDER_ID);
      expect(mockUpdateFn).toHaveBeenCalled();
    });

    it("deletes the cart by cartId from session metadata", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockUpdateFn.mockReturnValue(updateChain());
      mockDeleteFn.mockReturnValue(deleteChain());

      await service.handle({
        type: "checkout.session.completed",
        data: { object: makeSession() },
      } as any);

      expect(mockDeleteFn).toHaveBeenCalled();
    });

    it("skips cart deletion when cartId is missing from metadata", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockUpdateFn.mockReturnValue(updateChain());

      await service.handle({
        type: "checkout.session.completed",
        data: { object: makeSession({ metadata: { orderId: ORDER_ID, storeId: STORE_ID } }) },
      } as any);

      expect(mockDeleteFn).not.toHaveBeenCalled();
    });

    it("is idempotent — skips already-confirmed orders", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue({ ...mockOrder, status: "confirmed" });

      await service.handle({
        type: "checkout.session.completed",
        data: { object: makeSession() },
      } as any);

      expect(reservations.commit).not.toHaveBeenCalled();
    });

    it("logs warning and returns when orderId metadata is missing", async () => {
      await service.handle({
        type: "checkout.session.completed",
        data: { object: makeSession({ metadata: {} }) },
      } as any);

      expect(reservations.commit).not.toHaveBeenCalled();
    });

    it("logs audit event", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockUpdateFn.mockReturnValue(updateChain());
      mockDeleteFn.mockReturnValue(deleteChain());

      await service.handle({
        type: "checkout.session.completed",
        data: { object: makeSession() },
      } as any);

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "order.confirmed" }),
      );
    });

    it("captures tax from session and recalculates total", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockUpdateFn.mockReturnValue(updateChain());
      mockDeleteFn.mockReturnValue(deleteChain());

      await service.handle({
        type: "checkout.session.completed",
        data: {
          object: makeSession({
            total_details: { amount_tax: 250, amount_discount: 0, amount_shipping: 0 },
          }),
        },
      } as any);

      const setCall = mockUpdateFn.mock.results[0].value.set.mock.calls[0][0];
      expect(setCall.taxCents).toBe(250);
      expect(setCall.totalCents).toBe(mockOrder.subtotalCents + mockOrder.shippingCents + 250);
    });

    it("defaults taxCents to 0 when total_details is absent", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockUpdateFn.mockReturnValue(updateChain());
      mockDeleteFn.mockReturnValue(deleteChain());

      await service.handle({
        type: "checkout.session.completed",
        data: { object: makeSession({ total_details: null as any }) },
      } as any);

      const setCall = mockUpdateFn.mock.results[0].value.set.mock.calls[0][0];
      expect(setCall.taxCents).toBe(0);
    });

    it("reconciles shippingName/City/State/Zip/Country from session.shipping_details", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockUpdateFn.mockReturnValue(updateChain());
      mockDeleteFn.mockReturnValue(deleteChain());

      await service.handle({
        type: "checkout.session.completed",
        data: {
          object: makeSession({
            shipping_details: {
              name: "Ada Lovelace",
              address: {
                city: "Roy",
                state: "UT",
                postal_code: "84067",
                country: "US",
              },
            },
          } as any),
        },
      } as any);

      const setCall = mockUpdateFn.mock.results[0].value.set.mock.calls[0][0];
      expect(setCall.shippingName).toBe("Ada Lovelace");
      expect(setCall.shippingCity).toBe("Roy");
      expect(setCall.shippingState).toBe("UT");
      expect(setCall.shippingZip).toBe("84067");
      expect(setCall.shippingCountry).toBe("US");
    });

    it("reconciles from collected_information.shipping_details (the basil+ payload shape)", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockUpdateFn.mockReturnValue(updateChain());
      mockDeleteFn.mockReturnValue(deleteChain());

      await service.handle({
        type: "checkout.session.completed",
        data: {
          object: makeSession({
            shipping_details: undefined,
            collected_information: {
              shipping_details: {
                name: "Ada Lovelace",
                address: {
                  city: "Roy",
                  state: "UT",
                  postal_code: "84067",
                  country: "US",
                },
              },
            },
          } as any),
        },
      } as any);

      const setCall = mockUpdateFn.mock.results[0].value.set.mock.calls[0][0];
      expect(setCall.shippingName).toBe("Ada Lovelace");
      expect(setCall.shippingCity).toBe("Roy");
      expect(setCall.shippingState).toBe("UT");
      expect(setCall.shippingZip).toBe("84067");
      expect(setCall.shippingCountry).toBe("US");
    });

    it("never writes shippingLine1/Line2 — the street stays off our DB even with shipping_details present", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockUpdateFn.mockReturnValue(updateChain());
      mockDeleteFn.mockReturnValue(deleteChain());

      await service.handle({
        type: "checkout.session.completed",
        data: {
          object: makeSession({
            shipping_details: {
              name: "Ada Lovelace",
              address: { line1: "12 Baker St", city: "Roy", state: "UT", postal_code: "84067" },
            } as any,
          }),
        },
      } as any);

      const setCall = mockUpdateFn.mock.results[0].value.set.mock.calls[0][0];
      expect(setCall.shippingLine1).toBeUndefined();
      expect(setCall.shippingLine2).toBeUndefined();
    });

    it("leaves shipping name/city/state/zip/country out of the update when shipping_details is absent", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockUpdateFn.mockReturnValue(updateChain());
      mockDeleteFn.mockReturnValue(deleteChain());

      await service.handle({
        type: "checkout.session.completed",
        data: { object: makeSession({ shipping_details: null as any }) },
      } as any);

      const setCall = mockUpdateFn.mock.results[0].value.set.mock.calls[0][0];
      expect(setCall.shippingName).toBeUndefined();
      expect(setCall.shippingCity).toBeUndefined();
      expect(setCall.shippingState).toBeUndefined();
      expect(setCall.shippingZip).toBeUndefined();
      expect(setCall.shippingCountry).toBeUndefined();
    });

    it("enqueues order.confirmed notification job", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockUpdateFn.mockReturnValue(updateChain());
      mockDeleteFn.mockReturnValue(deleteChain());

      await service.handle({
        type: "checkout.session.completed",
        data: { object: makeSession() },
      } as any);

      expect(notificationsQueue.add).toHaveBeenCalledWith(
        "order.confirmed",
        { orderId: ORDER_ID, storeId: STORE_ID },
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  // ─── checkout.session.expired ─────────────────────────────────────────────

  describe("handle — checkout.session.expired", () => {
    it("releases reservations and marks order failed", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockUpdateFn.mockReturnValue(updateChain());

      await service.handle({
        type: "checkout.session.expired",
        data: { object: makeSession() },
      } as any);

      expect(reservations.releaseByOrder).toHaveBeenCalledWith(ORDER_ID);
      expect(mockUpdateFn).toHaveBeenCalled();
    });

    it("is idempotent — skips non-pending orders", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue({ ...mockOrder, status: "failed" });

      await service.handle({
        type: "checkout.session.expired",
        data: { object: makeSession() },
      } as any);

      expect(reservations.releaseByOrder).not.toHaveBeenCalled();
    });
  });

  // ─── account.updated ──────────────────────────────────────────────────────

  describe("handle — account.updated", () => {
    it("updates store Stripe status columns", async () => {
      mockUpdateFn.mockReturnValue(updateChain([{ id: STORE_ID }]));

      await service.handle({
        type: "account.updated",
        data: { object: makeAccount() },
      } as any);

      expect(mockUpdateFn).toHaveBeenCalled();
    });

    it("logs audit when store is found", async () => {
      mockUpdateFn.mockReturnValue(updateChain([{ id: STORE_ID }]));

      await service.handle({
        type: "account.updated",
        data: { object: makeAccount() },
      } as any);

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "store.stripe_account_updated" }),
      );
    });

    it("skips audit when no store matches the account", async () => {
      mockUpdateFn.mockReturnValue(updateChain([]));

      await service.handle({
        type: "account.updated",
        data: { object: makeAccount() },
      } as any);

      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  // ─── unknown events ───────────────────────────────────────────────────────

  describe("handle — unknown event", () => {
    it("logs debug and does nothing", async () => {
      await service.handle({ type: "customer.created", data: { object: {} } } as any);

      expect(reservations.commit).not.toHaveBeenCalled();
      expect(mockUpdateFn).not.toHaveBeenCalled();
    });
  });
});
