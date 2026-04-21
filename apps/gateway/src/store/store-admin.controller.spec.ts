import { AdminStoreGuard } from "./admin-store.guard";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";

import type { ResolvedStore } from "@sitehaus-ecom/auth";
import { of } from "rxjs";
import request from "supertest";
import { StoreAdminController } from "./store-admin.controller";
import { StoreService } from "./store.service";
import { RpcExceptionFilter } from "../filters/rpc-exception.filter";

const mockStore: ResolvedStore = {
  id: "store-uuid-1",
  clientId: "client-uuid-1",
  slug: "test-store",
  domain: "teststore.com",
  currency: "usd",
  stripeAccountId: null,
  stripeChargesEnabled: false,
  stripePayoutsEnabled: false,
  stripeDetailsSubmitted: false,
  reservationTtlMinutes: 15,
  notificationEmail: null,
};

const mockUser = {
  userId: "user-uuid-1",
  clientId: "client-uuid-1",
  email: "owner@example.com",
  firstName: "Test",
  lastName: "Owner",
  isVerified: true,
  status: "active",
  sessionId: "session-uuid-1",
  permissions: [],
};

describe("StoreAdminController", () => {
  let app: INestApplication;
  let mockPaymentsClient: { send: jest.Mock };
  let currentStore: ResolvedStore;

  beforeEach(async () => {
    currentStore = { ...mockStore };
    mockPaymentsClient = { send: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [StoreAdminController],
      providers: [
        { provide: StoreService, useValue: {} },
        { provide: "PAYMENTS_SERVICE", useValue: mockPaymentsClient },
      ],
    })
      .overrideGuard(AdminStoreGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new RpcExceptionFilter());
    app.use((_req: any, _res: any, next: any) => {
      _req.store = currentStore;
      _req.user = mockUser;
      next();
    });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe("POST /v1/admin/stores/connect-stripe", () => {
    it("returns 200 with url from payments client", async () => {
      mockPaymentsClient.send.mockReturnValue(
        of({ url: "https://connect.stripe.com/setup/e/abc123" }),
      );

      const res = await request(app.getHttpServer())
        .post("/v1/admin/stores/connect-stripe")
        .send({ returnUrl: "https://example.com/return" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        url: "https://connect.stripe.com/setup/e/abc123",
      });
    });

    it("sends the 'stripe.connect.initiate' message pattern to payments client", async () => {
      mockPaymentsClient.send.mockReturnValue(
        of({ url: "https://connect.stripe.com/setup/e/abc123" }),
      );

      await request(app.getHttpServer())
        .post("/v1/admin/stores/connect-stripe")
        .send({ returnUrl: "https://example.com/return" });

      expect(mockPaymentsClient.send).toHaveBeenCalledWith(
        "stripe.connect.initiate",
        expect.any(Object),
      );
    });

    it("includes storeId, stripeAccountId, and returnUrl in the payload", async () => {
      mockPaymentsClient.send.mockReturnValue(
        of({ url: "https://connect.stripe.com/setup/e/abc123" }),
      );

      await request(app.getHttpServer())
        .post("/v1/admin/stores/connect-stripe")
        .send({ returnUrl: "https://example.com/return" });

      expect(mockPaymentsClient.send).toHaveBeenCalledWith("stripe.connect.initiate", {
        storeId: mockStore.id,
        stripeAccountId: null,
        returnUrl: "https://example.com/return",
      });
    });

    it("passes null stripeAccountId (not undefined) when store has no account", async () => {
      currentStore = { ...mockStore, stripeAccountId: null };
      mockPaymentsClient.send.mockReturnValue(
        of({ url: "https://connect.stripe.com/setup/e/abc123" }),
      );

      await request(app.getHttpServer())
        .post("/v1/admin/stores/connect-stripe")
        .send({ returnUrl: "https://example.com/return" });

      const [, payload] = mockPaymentsClient.send.mock.calls[0];
      expect(payload.stripeAccountId).toBeNull();
    });

    it("passes existing stripeAccountId through unchanged", async () => {
      currentStore = { ...mockStore, stripeAccountId: "acct_existing_123" };
      mockPaymentsClient.send.mockReturnValue(
        of({ url: "https://connect.stripe.com/setup/e/abc123" }),
      );

      await request(app.getHttpServer())
        .post("/v1/admin/stores/connect-stripe")
        .send({ returnUrl: "https://example.com/return" });

      const [, payload] = mockPaymentsClient.send.mock.calls[0];
      expect(payload.stripeAccountId).toBe("acct_existing_123");
    });
  });

  describe("GET /v1/admin/stores/stripe-status", () => {
    it("returns connected: true when stripeAccountId is set (all flags false — live sync)", async () => {
      currentStore = { ...mockStore, stripeAccountId: "acct_123" };
      mockPaymentsClient.send.mockReturnValue(
        of({ chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false }),
      );

      const res = await request(app.getHttpServer()).get("/v1/admin/stores/stripe-status");

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
    });

    it("live syncs from Stripe when all flags are false", async () => {
      currentStore = { ...mockStore, stripeAccountId: "acct_123" };
      mockPaymentsClient.send.mockReturnValue(
        of({ chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true }),
      );

      const res = await request(app.getHttpServer()).get("/v1/admin/stores/stripe-status");

      expect(mockPaymentsClient.send).toHaveBeenCalledWith("stripe.account.sync", {
        storeId: mockStore.id,
        accountId: "acct_123",
      });
      expect(res.body).toEqual({
        connected: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      });
    });

    it("returns connected: false when stripeAccountId is null", async () => {
      currentStore = { ...mockStore, stripeAccountId: null };

      const res = await request(app.getHttpServer()).get("/v1/admin/stores/stripe-status");

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
    });

    it("maps all four status fields from the store", async () => {
      currentStore = {
        ...mockStore,
        stripeAccountId: "acct_123",
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeDetailsSubmitted: true,
      };

      const res = await request(app.getHttpServer()).get("/v1/admin/stores/stripe-status");

      expect(res.body).toEqual({
        connected: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      });
    });

    it("partially onboarded store — chargesEnabled and payoutsEnabled are independent", async () => {
      currentStore = {
        ...mockStore,
        stripeAccountId: "acct_123",
        stripeChargesEnabled: true,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: true,
      };

      const res = await request(app.getHttpServer()).get("/v1/admin/stores/stripe-status");

      expect(res.body.chargesEnabled).toBe(true);
      expect(res.body.payoutsEnabled).toBe(false);
      expect(res.body.detailsSubmitted).toBe(true);
    });
  });
});
