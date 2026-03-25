import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { StoreOwnerGuard } from "@sitehaus-ecom/auth";
import type { ResolvedStore } from "@sitehaus-ecom/auth";
import { RpcException } from "@nestjs/microservices";
import { of, throwError } from "rxjs";
import request from "supertest";
import { OrdersAdminController } from "./orders-admin.controller";
import { RpcExceptionFilter } from "../filters/rpc-exception.filter";

const mockStore: ResolvedStore = {
  id: "store-uuid-1",
  clientId: "client-uuid-1",
  slug: "test-store",
  domain: null,
  currency: "usd",
  stripeAccountId: null,
  stripeChargesEnabled: false,
  stripePayoutsEnabled: false,
  stripeDetailsSubmitted: false,
  reservationTtlMinutes: 15,
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

const ORDER_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const mockOrderSummary = {
  id: ORDER_ID,
  status: "confirmed",
  email: "customer@example.com",
  itemCount: 2,
  subtotalCents: 4000,
  totalCents: 4000,
  currency: "usd",
  shippingCountry: "CA",
  trackingNumber: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  confirmedAt: "2026-01-01T00:01:00.000Z",
  shippedAt: null,
};

const mockOrderDetail = {
  ...mockOrderSummary,
  shippingName: "Jane Doe",
  shippingLine1: "123 Main St",
  shippingLine2: null,
  shippingCity: "Vancouver",
  shippingState: "BC",
  shippingZip: "V6B 1A1",
  shippingCents: 0,
  taxCents: 0,
  notes: null,
  stripePaymentIntentId: "pi_abc123",
  items: [
    {
      productName: "Vitamin C",
      variantName: "90 caps",
      sku: null,
      quantity: 2,
      unitPriceCents: 2000,
      totalCents: 4000,
    },
  ],
};

describe("OrdersAdminController", () => {
  let app: INestApplication;
  let mockCommerceClient: { send: jest.Mock };

  beforeEach(async () => {
    mockCommerceClient = { send: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [OrdersAdminController],
      providers: [{ provide: "COMMERCE_SERVICE", useValue: mockCommerceClient }],
    })
      .overrideGuard(StoreOwnerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new RpcExceptionFilter());
    app.use((_req: any, _res: any, next: any) => {
      _req.store = mockStore;
      _req.user = mockUser;
      next();
    });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ─── GET /v1/admin/orders ────────────────────────────────────────────────────

  describe("GET /v1/admin/orders", () => {
    it("returns 200 with paginated list", async () => {
      mockCommerceClient.send.mockReturnValue(of({ items: [mockOrderSummary], total: 1 }));

      const res = await request(app.getHttpServer()).get("/v1/admin/orders?limit=20&offset=0");

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].itemCount).toBe(2);
    });

    it("sends 'orders.adminList' with storeId and query params", async () => {
      mockCommerceClient.send.mockReturnValue(of({ items: [], total: 0 }));

      await request(app.getHttpServer()).get("/v1/admin/orders?limit=20&offset=0&sort=oldest");

      expect(mockCommerceClient.send).toHaveBeenCalledWith(
        "orders.adminList",
        expect.objectContaining({ storeId: mockStore.id, limit: 20, offset: 0, sort: "oldest" }),
      );
    });

    it("forwards status and email filters", async () => {
      mockCommerceClient.send.mockReturnValue(of({ items: [], total: 0 }));

      await request(app.getHttpServer()).get(
        "/v1/admin/orders?status=confirmed&status=shipped&email=test@example.com",
      );

      expect(mockCommerceClient.send).toHaveBeenCalledWith(
        "orders.adminList",
        expect.objectContaining({
          status: ["confirmed", "shipped"],
          email: "test@example.com",
        }),
      );
    });
  });

  // ─── GET /v1/admin/orders/:orderId ───────────────────────────────────────────

  describe("GET /v1/admin/orders/:orderId", () => {
    it("returns 200 with full order detail", async () => {
      mockCommerceClient.send.mockReturnValue(of(mockOrderDetail));

      const res = await request(app.getHttpServer()).get(`/v1/admin/orders/${ORDER_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.stripePaymentIntentId).toBe("pi_abc123");
      expect(res.body.shippingName).toBe("Jane Doe");
      expect(res.body.items).toHaveLength(1);
    });

    it("sends 'orders.adminGet' with storeId and orderId", async () => {
      mockCommerceClient.send.mockReturnValue(of(mockOrderDetail));

      await request(app.getHttpServer()).get(`/v1/admin/orders/${ORDER_ID}`);

      expect(mockCommerceClient.send).toHaveBeenCalledWith("orders.adminGet", {
        storeId: mockStore.id,
        orderId: ORDER_ID,
      });
    });
  });

  // ─── RPC error propagation ───────────────────────────────────────────────────

  describe("RPC error propagation", () => {
    it("converts RpcException 404 to HTTP 404", async () => {
      mockCommerceClient.send.mockReturnValue(
        throwError(() => new RpcException({ status: 404, message: "Order not found" })),
      );

      const res = await request(app.getHttpServer()).get(`/v1/admin/orders/${ORDER_ID}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Order not found");
    });
  });
});
