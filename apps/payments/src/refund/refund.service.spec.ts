import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import { Test, TestingModule } from "@nestjs/testing";
import { RefundService } from "./refund.service";

const ORDER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const STORE_ID = "aaaaaaaa-0000-4000-8000-000000000002";
const STRIPE_ACCOUNT_ID = "acct_test123";
const STRIPE_PI_ID = "pi_abc123";

const mockStore = { stripeAccountId: STRIPE_ACCOUNT_ID };

const mockOrder = {
  id: ORDER_ID,
  storeId: STORE_ID,
  email: "customer@example.com",
  status: "confirmed" as const,
  stripePaymentIntentId: STRIPE_PI_ID,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  confirmedAt: new Date("2026-01-01T00:01:00Z"),
  shippedAt: null,
  trackingNumber: null,
  shippingName: "Jane Doe",
  shippingLine1: "123 Main St",
  shippingLine2: null,
  shippingCity: "Vancouver",
  shippingState: "BC",
  shippingZip: "V6B 1A1",
  shippingCountry: "CA",
  subtotalCents: 2500,
  shippingCents: 0,
  taxCents: 0,
  totalCents: 2500,
  currency: "cad",
  notes: null,
};

const mockItems = [
  {
    productName: "Vitamin C",
    variantName: "90 Capsules",
    sku: "VIT-C-90",
    quantity: 1,
    unitPriceCents: 2500,
    totalCents: 2500,
  },
];

function selectChain(rows: any[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(rows),
    }),
  };
}

function updateChain(returnRows: any[] = [{ id: ORDER_ID }]) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(returnRows),
      }),
    }),
  };
}

describe("RefundService", () => {
  let service: RefundService;
  let db: any;
  let mockRefundsCreate: jest.Mock;
  let mockAudit: { log: jest.Mock };

  beforeEach(async () => {
    mockRefundsCreate = jest.fn().mockResolvedValue({ id: "re_test123" });
    mockAudit = { log: jest.fn() };

    db = {
      query: { ordersTable: { findFirst: jest.fn() } },
      select: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        { provide: DB_TOKEN, useValue: db },
        { provide: AuditService, useValue: mockAudit },
        { provide: ConfigService, useValue: { getOrThrow: () => "sk_test_dummy" } },
      ],
    }).compile();

    service = module.get(RefundService);
    (service as any).stripe = { refunds: { create: mockRefundsCreate } };
  });

  describe("refund", () => {
    it("calls Stripe and marks order as refunded", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.update.mockReturnValue(updateChain());
      db.select
        .mockReturnValueOnce(selectChain([{ itemCount: 1 }]))
        .mockReturnValueOnce(selectChain(mockItems));

      const result = await service.refund({
        storeId: STORE_ID,
        orderId: ORDER_ID,
        store: mockStore,
      });

      expect(mockRefundsCreate).toHaveBeenCalledWith(
        { payment_intent: STRIPE_PI_ID },
        { stripeAccount: STRIPE_ACCOUNT_ID },
      );
      expect(db.update).toHaveBeenCalled();
      expect(result.status).toBe("refunded");
      expect(result.stripePaymentIntentId).toBe(STRIPE_PI_ID);
    });

    it("returns full admin order shape with items", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.update.mockReturnValue(updateChain());
      db.select
        .mockReturnValueOnce(selectChain([{ itemCount: 1 }]))
        .mockReturnValueOnce(selectChain(mockItems));

      const result = await service.refund({
        storeId: STORE_ID,
        orderId: ORDER_ID,
        store: mockStore,
      });

      expect(result.items).toHaveLength(1);
      expect(result.itemCount).toBe(1);
      expect(result.shippingName).toBe("Jane Doe");
    });

    it("fires audit log with stripePaymentIntentId in meta", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.update.mockReturnValue(updateChain());
      db.select
        .mockReturnValueOnce(selectChain([{ itemCount: 1 }]))
        .mockReturnValueOnce(selectChain(mockItems));

      await service.refund({ storeId: STORE_ID, orderId: ORDER_ID, store: mockStore });

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "order.refunded",
          meta: { stripePaymentIntentId: STRIPE_PI_ID },
        }),
      );
    });

    it("throws RpcException 404 when order not found", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(null);

      await expect(
        service.refund({ storeId: STORE_ID, orderId: ORDER_ID, store: mockStore }),
      ).rejects.toThrow(RpcException);
    });

    it("throws RpcException 404 when order belongs to a different store", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue({ ...mockOrder, storeId: "other-store" });

      await expect(
        service.refund({ storeId: STORE_ID, orderId: ORDER_ID, store: mockStore }),
      ).rejects.toThrow(RpcException);
    });

    it("throws RpcException 400 when status is pending", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue({ ...mockOrder, status: "pending" });

      await expect(
        service.refund({ storeId: STORE_ID, orderId: ORDER_ID, store: mockStore }),
      ).rejects.toThrow(RpcException);
    });

    it("throws RpcException 400 when status is already refunded", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue({ ...mockOrder, status: "refunded" });

      await expect(
        service.refund({ storeId: STORE_ID, orderId: ORDER_ID, store: mockStore }),
      ).rejects.toThrow(RpcException);
    });

    it("throws RpcException 400 when stripePaymentIntentId is missing", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue({
        ...mockOrder,
        stripePaymentIntentId: null,
      });

      await expect(
        service.refund({ storeId: STORE_ID, orderId: ORDER_ID, store: mockStore }),
      ).rejects.toThrow(RpcException);
    });

    it("throws RpcException 502 when Stripe call fails and does NOT update order", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      mockRefundsCreate.mockRejectedValue(new Error("Your refund window has expired"));

      await expect(
        service.refund({ storeId: STORE_ID, orderId: ORDER_ID, store: mockStore }),
      ).rejects.toThrow(RpcException);

      expect(db.update).not.toHaveBeenCalled();
    });

    it("also refunds shipped orders", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue({ ...mockOrder, status: "shipped" });
      db.update.mockReturnValue(updateChain());
      db.select
        .mockReturnValueOnce(selectChain([{ itemCount: 1 }]))
        .mockReturnValueOnce(selectChain(mockItems));

      const result = await service.refund({
        storeId: STORE_ID,
        orderId: ORDER_ID,
        store: mockStore,
      });

      expect(result.status).toBe("refunded");
    });
  });
});
