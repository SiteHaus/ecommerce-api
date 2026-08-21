import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import type { ResolvedStore } from "@sitehaus-ecom/auth";
import { of, throwError } from "rxjs";
import request from "supertest";
import { OrdersController } from "./orders.controller";

const mockStore: ResolvedStore = {
  id: "store-uuid-1",
  clientId: "client-uuid-1",
  slug: "test-store",
  domain: null,
  currency: "usd",
  stripeAccountId: "acct_test123",
  stripeChargesEnabled: true,
  stripePayoutsEnabled: false,
  stripeDetailsSubmitted: false,
  reservationTtlMinutes: 15,
  fulfillmentType: "shipping" as const,
  taxRegistrationConfirmed: false,
  notificationEmail: null,
  notificationPreferences: null,
};

const ORDER_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const mockOrderDetail = {
  id: ORDER_ID,
  status: "confirmed",
  email: "customer@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  confirmedAt: "2026-01-01T00:01:00.000Z",
  shippedAt: null,
  deliveredAt: null,
  trackingNumber: null,
  shipping: {
    name: "Jane Doe",
    line1: "123 Main St",
    line2: null,
    city: "Vancouver",
    state: "BC",
    zip: "V6B 1A1",
    country: "CA",
  },
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
  subtotalCents: 4000,
  shippingCents: 0,
  taxCents: 0,
  totalCents: 4000,
  currency: "usd",
};

describe("OrdersController", () => {
  let app: INestApplication;
  let mockCommerceClient: { send: jest.Mock };
  let mockPaymentsClient: { send: jest.Mock };

  beforeEach(async () => {
    mockCommerceClient = { send: jest.fn() };
    mockPaymentsClient = { send: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: "COMMERCE_SERVICE", useValue: mockCommerceClient },
        { provide: "PAYMENTS_SERVICE", useValue: mockPaymentsClient },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((_req: any, _res: any, next: any) => {
      _req.store = mockStore;
      next();
    });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ─── GET /v1/orders/:orderId ─────────────────────────────────────────────────

  describe("GET /v1/orders/:orderId", () => {
    it("returns 200 with full order detail", async () => {
      mockCommerceClient.send.mockReturnValue(of(mockOrderDetail));
      mockPaymentsClient.send.mockReturnValue(of({ line1: null, line2: null }));

      const res = await request(app.getHttpServer()).get(
        `/v1/orders/${ORDER_ID}?email=customer@example.com`,
      );

      expect(res.status).toBe(200);
      expect(res.body.shipping.name).toBe("Jane Doe");
      expect(res.body.items).toHaveLength(1);
    });

    it("fills the street from Stripe on a new order", async () => {
      mockCommerceClient.send.mockReturnValue(
        of({
          ...mockOrderDetail,
          shipping: { ...mockOrderDetail.shipping, line1: "", line2: null },
        }),
      );
      mockPaymentsClient.send.mockReturnValue(of({ line1: "12 Baker St", line2: "Flat 4" }));

      const res = await request(app.getHttpServer()).get(
        `/v1/orders/${ORDER_ID}?email=customer@example.com`,
      );

      expect(res.body.shipping.line1).toBe("12 Baker St");
      expect(res.body.shipping.line2).toBe("Flat 4");
    });

    it("keeps the legacy column value when Stripe returns nulls", async () => {
      mockCommerceClient.send.mockReturnValue(
        of({
          ...mockOrderDetail,
          shipping: { ...mockOrderDetail.shipping, line1: "9 Old Rd", line2: null },
        }),
      );
      mockPaymentsClient.send.mockReturnValue(of({ line1: null, line2: null }));

      const res = await request(app.getHttpServer()).get(
        `/v1/orders/${ORDER_ID}?email=customer@example.com`,
      );

      expect(res.body.shipping.line1).toBe("9 Old Rd");
    });

    it("renders the order anyway when payments is down", async () => {
      mockCommerceClient.send.mockReturnValue(
        of({
          ...mockOrderDetail,
          shipping: { ...mockOrderDetail.shipping, line1: "", line2: null },
        }),
      );
      mockPaymentsClient.send.mockReturnValue(throwError(() => new Error("ECONNREFUSED")));

      const res = await request(app.getHttpServer()).get(
        `/v1/orders/${ORDER_ID}?email=customer@example.com`,
      );

      expect(res.status).toBe(200); // the page must not die over a missing street
      expect(res.body.shipping.line1).toBe("");
    });
  });
});
