import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { Test, TestingModule } from "@nestjs/testing";
import { OrdersHandlerService } from "./orders-handler.service";

const STORE_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const ORDER_ID = "aaaaaaaa-0000-4000-8000-000000000002";
const USER_ID = "aaaaaaaa-0000-4000-8000-000000000003";

const mockOrder = {
  id: ORDER_ID,
  storeId: STORE_ID,
  userId: USER_ID,
  email: "customer@example.com",
  status: "confirmed",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  confirmedAt: new Date("2026-01-01T00:01:00Z"),
  shippedAt: null,
  deliveredAt: null,
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

function countChain(n: number) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([{ count: String(n) }]),
    }),
  };
}

function subqueryChain() {
  return {
    from: jest.fn().mockReturnValue({
      groupBy: jest.fn().mockReturnValue({
        as: jest.fn().mockReturnValue({ __sq: true }),
      }),
    }),
  };
}

function adminListChain(rows: any[]) {
  return {
    from: jest.fn().mockReturnValue({
      leftJoin: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              offset: jest.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      }),
    }),
  };
}

describe("OrdersHandlerService", () => {
  let service: OrdersHandlerService;
  let db: any;

  beforeEach(async () => {
    db = {
      query: {
        ordersTable: { findFirst: jest.fn(), findMany: jest.fn() },
      },
      select: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersHandlerService, { provide: DB_TOKEN, useValue: db }],
    }).compile();

    service = module.get(OrdersHandlerService);
  });

  // ─── getForCustomer ───────────────────────────────────────────────────────

  describe("getForCustomer", () => {
    it("returns order detail for authenticated user", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.select.mockReturnValue(selectChain(mockItems));

      const result = await service.getForCustomer({
        storeId: STORE_ID,
        orderId: ORDER_ID,
        userId: USER_ID,
      });

      expect(result.id).toBe(ORDER_ID);
      expect(result.status).toBe("confirmed");
      expect(result.items).toHaveLength(1);
      expect(result.shipping.city).toBe("Vancouver");
    });

    it("returns order detail for anonymous user with matching email", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.select.mockReturnValue(selectChain(mockItems));

      const result = await service.getForCustomer({
        storeId: STORE_ID,
        orderId: ORDER_ID,
        email: "customer@example.com",
      });

      expect(result.id).toBe(ORDER_ID);
    });

    it("email match is case-insensitive", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
      db.select.mockReturnValue(selectChain(mockItems));

      const result = await service.getForCustomer({
        storeId: STORE_ID,
        orderId: ORDER_ID,
        email: "CUSTOMER@EXAMPLE.COM",
      });

      expect(result.id).toBe(ORDER_ID);
    });

    it("throws NotFoundException when order does not exist", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(null);

      await expect(
        service.getForCustomer({ storeId: STORE_ID, orderId: ORDER_ID, userId: USER_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when order belongs to a different store", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue({ ...mockOrder, storeId: "other-store" });

      await expect(
        service.getForCustomer({ storeId: STORE_ID, orderId: ORDER_ID, userId: USER_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when userId does not match", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);

      await expect(
        service.getForCustomer({ storeId: STORE_ID, orderId: ORDER_ID, userId: "wrong-user" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws ForbiddenException when email does not match", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);

      await expect(
        service.getForCustomer({
          storeId: STORE_ID,
          orderId: ORDER_ID,
          email: "wrong@example.com",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws ForbiddenException when neither userId nor email provided", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);

      await expect(
        service.getForCustomer({ storeId: STORE_ID, orderId: ORDER_ID }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("never exposes stripePaymentIntentId", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue({
        ...mockOrder,
        stripePaymentIntentId: "pi_secret_123",
      });
      db.select.mockReturnValue(selectChain(mockItems));

      const result = await service.getForCustomer({
        storeId: STORE_ID,
        orderId: ORDER_ID,
        userId: USER_ID,
      });

      expect(result).not.toHaveProperty("stripePaymentIntentId");
    });
  });

  // ─── listForCustomer ──────────────────────────────────────────────────────

  describe("listForCustomer", () => {
    function listSelectMocks(count: number, rows: any[]) {
      db.select.mockReturnValueOnce(countChain(count)).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                offset: jest.fn().mockResolvedValue(rows),
              }),
            }),
          }),
        }),
      });
    }

    it("returns paginated order list for authenticated user", async () => {
      listSelectMocks(2, [mockOrder, mockOrder]);

      const result = await service.listForCustomer({
        storeId: STORE_ID,
        userId: USER_ID,
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it("items do not include shipping address", async () => {
      listSelectMocks(1, [mockOrder]);

      const result = await service.listForCustomer({
        storeId: STORE_ID,
        userId: USER_ID,
        limit: 10,
        offset: 0,
      });

      expect(result.items[0]).not.toHaveProperty("shipping");
      expect(result.items[0]).not.toHaveProperty("items");
    });

    it("returns empty list when user has no orders", async () => {
      listSelectMocks(0, []);

      const result = await service.listForCustomer({
        storeId: STORE_ID,
        userId: USER_ID,
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  // ─── adminGet ─────────────────────────────────────────────────────────────

  describe("adminGet", () => {
    it("returns full admin detail including stripe and shipping fields", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue({
        ...mockOrder,
        stripePaymentIntentId: "pi_abc123",
        notes: "VIP customer",
      });
      db.select
        .mockReturnValueOnce(selectChain([{ itemCount: 2 }]))
        .mockReturnValueOnce(selectChain(mockItems));

      const result = await service.adminGet({ storeId: STORE_ID, orderId: ORDER_ID });

      expect(result.stripePaymentIntentId).toBe("pi_abc123");
      expect(result.notes).toBe("VIP customer");
      expect(result.itemCount).toBe(2);
      expect(result.items).toHaveLength(1);
      expect(result.shippingName).toBe("Jane Doe");
    });

    it("throws NotFoundException when order not found", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue(null);

      await expect(service.adminGet({ storeId: STORE_ID, orderId: ORDER_ID })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NotFoundException when order belongs to a different store", async () => {
      db.query.ordersTable.findFirst.mockResolvedValue({ ...mockOrder, storeId: "other" });

      await expect(service.adminGet({ storeId: STORE_ID, orderId: ORDER_ID })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── adminList ────────────────────────────────────────────────────────────

  describe("adminList", () => {
    const adminRow = {
      ...mockOrder,
      itemCount: 1,
    };

    function adminListMocks(count: number, rows: any[]) {
      db.select
        .mockReturnValueOnce(subqueryChain())
        .mockReturnValueOnce(countChain(count))
        .mockReturnValueOnce(adminListChain(rows));
    }

    it("returns paginated list with itemCount", async () => {
      adminListMocks(3, [adminRow, adminRow, adminRow]);

      const result = await service.adminList({
        storeId: STORE_ID,
        limit: 20,
        offset: 0,
        sort: "newest",
      });

      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(3);
      expect(result.items[0].itemCount).toBe(1);
    });

    it("returns empty list when no orders", async () => {
      adminListMocks(0, []);

      const result = await service.adminList({
        storeId: STORE_ID,
        limit: 20,
        offset: 0,
        sort: "newest",
      });

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it("items do not include items array or shipping address detail", async () => {
      adminListMocks(1, [adminRow]);

      const result = await service.adminList({
        storeId: STORE_ID,
        limit: 20,
        offset: 0,
        sort: "newest",
      });

      expect(result.items[0]).not.toHaveProperty("items");
      expect(result.items[0]).not.toHaveProperty("shippingName");
    });
  });
});
