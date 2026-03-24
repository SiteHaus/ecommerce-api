import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { CheckoutService } from "./checkout.service";
import { ReservationService } from "../inventory/reservation.service";

const STORE_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const SESSION_TOKEN = "session-abc";
const ORDER_ID = "aaaaaaaa-0000-0000-0000-000000000002";
const CART_ID = "aaaaaaaa-0000-0000-0000-000000000003";
const VARIANT_ID = "aaaaaaaa-0000-0000-0000-000000000004";

const futureDate = new Date(Date.now() + 86_400_000);
const pastDate = new Date(Date.now() - 1000);

const mockCart = {
  id: CART_ID,
  storeId: STORE_ID,
  sessionToken: SESSION_TOKEN,
  expiresAt: futureDate,
};
const mockStore = { currency: "usd" };
const mockOrder = { id: ORDER_ID, storeId: STORE_ID, totalCents: 2000 };

const mockItems = [
  {
    variantId: VARIANT_ID,
    quantity: 2,
    productName: "Test Product",
    variantName: "Default",
    sku: "SKU-001",
    priceCents: 1000,
    allowBackorder: false,
  },
];

// ── chain builders ────────────────────────────────────────────────────────────

function selectChain(rows: any[]) {
  const chain: any = {
    from: jest.fn(),
    innerJoin: jest.fn(),
    where: jest.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  return chain;
}

function insertChain(returning: any[]) {
  return {
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(returning),
    }),
  };
}

function insertNoReturnChain() {
  return { values: jest.fn().mockResolvedValue(undefined) };
}

function deleteChain() {
  return { where: jest.fn().mockResolvedValue(undefined) };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("CheckoutService", () => {
  let service: CheckoutService;
  let db: any;
  let reservations: jest.Mocked<ReservationService>;
  let audit: { log: jest.Mock };

  const validPayload = {
    storeId: STORE_ID,
    sessionToken: SESSION_TOKEN,
    email: "test@example.com",
    shippingName: "John Doe",
    shippingLine1: "123 Main St",
    shippingCity: "Vancouver",
    shippingState: "BC",
    shippingZip: "V5K 0A1",
    shippingCountry: "CA",
  };

  beforeEach(async () => {
    db = {
      query: {
        cartsTable: { findFirst: jest.fn() },
        storesTable: { findFirst: jest.fn() },
      },
      select: jest.fn(),
      insert: jest.fn(),
      delete: jest.fn(),
    };

    reservations = {
      reserve: jest.fn(),
      releaseByOrder: jest.fn(),
      commit: jest.fn(),
      expireStale: jest.fn(),
    } as any;

    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: DB_TOKEN, useValue: db },
        { provide: ReservationService, useValue: reservations },
        { provide: "AuditService", useValue: audit },
      ],
    })
      .overrideProvider("AuditService")
      .useValue(audit)
      .compile();

    // Manually construct since AuditService isn't a token we control directly
    service = new (CheckoutService as any)(db, reservations, audit);
  });

  describe("createOrder", () => {
    it("creates order, snapshots items, reserves inventory, and returns totals", async () => {
      db.query.cartsTable.findFirst.mockResolvedValue(mockCart);
      db.select.mockReturnValue(selectChain(mockItems));
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.insert
        .mockReturnValueOnce(insertChain([mockOrder])) // ordersTable
        .mockReturnValueOnce(insertNoReturnChain()); // orderItemsTable
      reservations.reserve.mockResolvedValue("reserved");

      const result = await service.createOrder(validPayload);

      expect(result.orderId).toBe(ORDER_ID);
      expect(result.subtotalCents).toBe(2000); // 1000 * 2
      expect(result.shippingCents).toBe(0);
      expect(result.totalCents).toBe(2000);
      expect(reservations.reserve).toHaveBeenCalledWith(VARIANT_ID, ORDER_ID, STORE_ID, 2);
    });

    it("throws if cart is not found", async () => {
      db.query.cartsTable.findFirst.mockResolvedValue(null);
      await expect(service.createOrder(validPayload)).rejects.toThrow(BadRequestException);
    });

    it("throws if cart has expired", async () => {
      db.query.cartsTable.findFirst.mockResolvedValue({ ...mockCart, expiresAt: pastDate });
      await expect(service.createOrder(validPayload)).rejects.toThrow("Cart has expired");
    });

    it("throws if cart is empty", async () => {
      db.query.cartsTable.findFirst.mockResolvedValue(mockCart);
      db.select.mockReturnValue(selectChain([]));
      await expect(service.createOrder(validPayload)).rejects.toThrow("Cart is empty");
    });

    it("releases reservations and deletes order when an item is sold out", async () => {
      db.query.cartsTable.findFirst.mockResolvedValue(mockCart);
      db.select.mockReturnValue(selectChain(mockItems));
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.insert
        .mockReturnValueOnce(insertChain([mockOrder]))
        .mockReturnValueOnce(insertNoReturnChain());
      db.delete.mockReturnValue(deleteChain());
      reservations.reserve.mockResolvedValue("sold_out");
      reservations.releaseByOrder.mockResolvedValue(undefined);

      await expect(service.createOrder(validPayload)).rejects.toThrow("out of stock");
      expect(reservations.releaseByOrder).toHaveBeenCalledWith(ORDER_ID);
      expect(db.delete).toHaveBeenCalled();
    });

    it("succeeds when sold_out item has allowBackorder enabled", async () => {
      const backorderItem = { ...mockItems[0], allowBackorder: true };
      db.query.cartsTable.findFirst.mockResolvedValue(mockCart);
      db.select.mockReturnValue(selectChain([backorderItem]));
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.insert
        .mockReturnValueOnce(insertChain([mockOrder]))
        .mockReturnValueOnce(insertNoReturnChain());
      reservations.reserve.mockResolvedValue("sold_out");

      const result = await service.createOrder(validPayload);

      expect(result.orderId).toBe(ORDER_ID);
      expect(reservations.releaseByOrder).not.toHaveBeenCalled();
    });

    it("includes all sold-out item names in the error message", async () => {
      const twoItems = [
        { ...mockItems[0], variantName: "Red", allowBackorder: false },
        { ...mockItems[0], variantId: "variant-2", variantName: "Blue", allowBackorder: false },
      ];
      db.query.cartsTable.findFirst.mockResolvedValue(mockCart);
      db.select.mockReturnValue(selectChain(twoItems));
      db.query.storesTable.findFirst.mockResolvedValue(mockStore);
      db.insert
        .mockReturnValueOnce(insertChain([mockOrder]))
        .mockReturnValueOnce(insertNoReturnChain());
      db.delete.mockReturnValue(deleteChain());
      reservations.reserve.mockResolvedValue("sold_out");
      reservations.releaseByOrder.mockResolvedValue(undefined);

      await expect(service.createOrder(validPayload)).rejects.toThrow(/Red.*Blue|Blue.*Red/);
    });

    it("falls back to usd currency when store not found", async () => {
      db.query.cartsTable.findFirst.mockResolvedValue(mockCart);
      db.select.mockReturnValue(selectChain(mockItems));
      db.query.storesTable.findFirst.mockResolvedValue(null);
      db.insert
        .mockReturnValueOnce(insertChain([{ ...mockOrder }]))
        .mockReturnValueOnce(insertNoReturnChain());
      reservations.reserve.mockResolvedValue("reserved");

      const result = await service.createOrder(validPayload);
      expect(result.currency).toBe("usd");
    });
  });
});
