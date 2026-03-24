import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { CartHandlerService } from "./cart-handler.service";

const STORE_ID = "store-uuid-1";
const SESSION_TOKEN = "session-token-abc";
const USER_ID = "user-uuid-1";
const VARIANT_ID = "variant-uuid-1";
const CART_ID = "cart-uuid-1";
const ANON_CART_ID = "cart-anon-1";
const USER_CART_ID = "cart-user-1";

// ─── chain builders ──────────────────────────────────────────────────────────

function selectChain(rows: any[], withJoins = false) {
  // .where must always return something that has .limit (and resolves)
  // because some queries end with .where(…).limit(1) while others end with .where(…)
  const whereResult: any = {
    limit: jest.fn().mockResolvedValue(rows),
    // also make it thenable so callers that await .where directly still work
    then: jest.fn((resolve: any) => Promise.resolve(rows).then(resolve)),
  };
  const chain: any = {
    from: jest.fn(),
    where: jest.fn().mockReturnValue(whereResult),
    limit: jest.fn().mockResolvedValue(rows),
    orderBy: jest.fn().mockResolvedValue(rows),
    innerJoin: jest.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  return chain;
}

function selectDistinctOnChain(rows: any[]) {
  const chain: any = {
    from: jest.fn(),
    where: jest.fn().mockResolvedValue(rows),
    orderBy: jest.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue({
    orderBy: jest.fn().mockResolvedValue(rows),
  });
  return chain;
}

function insertChain(returning: any[]) {
  return {
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(returning),
    }),
  };
}

function insertNoReturningChain() {
  return {
    values: jest.fn().mockResolvedValue(undefined),
  };
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

function updateNoReturningChain() {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  };
}

function deleteChain() {
  return {
    where: jest.fn().mockResolvedValue(undefined),
  };
}

// ─── fixtures ────────────────────────────────────────────────────────────────

const cartRow = {
  id: CART_ID,
  storeId: STORE_ID,
  sessionToken: SESSION_TOKEN,
  userId: null,
  expiresAt: new Date("2024-01-08T00:00:00Z"),
};

const variantRow = {
  variantId: VARIANT_ID,
  isActive: true,
  productStatus: "active",
  goesLiveAt: null,
};

const enrichedItemRow = {
  variantId: VARIANT_ID,
  quantity: 2,
  productId: "product-uuid-1",
  productName: "Test Product",
  variantName: "Default",
  sku: "SKU-001",
  priceCents: 2000,
  compareAtCents: null,
  stock: 100,
  reserved: 5,
  allowBackorder: false,
};

describe("CartHandlerService", () => {
  let service: CartHandlerService;
  let mockDb: any;
  let mockSelectFn: jest.Mock;
  let mockSelectDistinctOnFn: jest.Mock;
  let mockInsertFn: jest.Mock;
  let mockUpdateFn: jest.Mock;
  let mockDeleteFn: jest.Mock;
  let mockCartFindFirst: jest.Mock;
  let mockCartsTableFindFirst: jest.Mock;
  let mockCartItemFindFirst: jest.Mock;
  let mockCartItemFindMany: jest.Mock;

  beforeEach(async () => {
    mockSelectFn = jest.fn();
    mockSelectDistinctOnFn = jest.fn();
    mockInsertFn = jest.fn();
    mockUpdateFn = jest.fn();
    mockDeleteFn = jest.fn();
    mockCartFindFirst = jest.fn();
    mockCartsTableFindFirst = jest.fn();
    mockCartItemFindFirst = jest.fn();
    mockCartItemFindMany = jest.fn();

    mockDb = {
      select: mockSelectFn,
      selectDistinctOn: mockSelectDistinctOnFn,
      insert: mockInsertFn,
      update: mockUpdateFn,
      delete: mockDeleteFn,
      query: {
        cartsTable: {
          findFirst: mockCartFindFirst,
        },
        cartItemsTable: {
          findFirst: mockCartItemFindFirst,
          findMany: mockCartItemFindMany,
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CartHandlerService, { provide: DB_TOKEN, useValue: mockDb }],
    }).compile();

    service = module.get(CartHandlerService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── toAvailability (tested indirectly via enrichCart) ────────────────────

  describe("toAvailability (via enrichCart path)", () => {
    function setupEnrichCart(invStock: number, invReserved: number, allowBackorder: boolean) {
      // findCart returns a cart
      mockCartFindFirst
        .mockResolvedValueOnce(cartRow) // findCart
        .mockResolvedValueOnce(cartRow); // enrichCart inner findFirst

      const rowWithInventory = {
        ...enrichedItemRow,
        stock: invStock,
        reserved: invReserved,
        allowBackorder,
      };
      // enrichCart select chain (innerJoins)
      mockSelectFn.mockReturnValueOnce(selectChain([rowWithInventory], true));
      // selectDistinctOn for images (empty — productIds will be non-empty so query runs)
      mockSelectDistinctOnFn.mockReturnValueOnce(selectDistinctOnChain([]));
    }

    it("availability is in_stock when allowBackorder is true regardless of stock", async () => {
      setupEnrichCart(0, 0, true);

      const result = await service.get({ storeId: STORE_ID, sessionToken: SESSION_TOKEN });

      expect(result.items[0].availability).toBe("in_stock");
    });

    it("availability is in_stock when available > 10", async () => {
      setupEnrichCart(100, 5, false); // available = 95

      const result = await service.get({ storeId: STORE_ID, sessionToken: SESSION_TOKEN });

      expect(result.items[0].availability).toBe("in_stock");
    });

    it("availability is low_stock when available is between 1 and 10 inclusive", async () => {
      setupEnrichCart(15, 10, false); // available = 5

      const result = await service.get({ storeId: STORE_ID, sessionToken: SESSION_TOKEN });

      expect(result.items[0].availability).toBe("low_stock");
    });

    it("availability is out_of_stock when available is 0 and backorder disabled", async () => {
      setupEnrichCart(10, 10, false); // available = 0

      const result = await service.get({ storeId: STORE_ID, sessionToken: SESSION_TOKEN });

      expect(result.items[0].availability).toBe("out_of_stock");
    });
  });

  // ─── get ──────────────────────────────────────────────────────────────────

  describe("get", () => {
    it("returns empty cart shape when no cart exists", async () => {
      mockCartFindFirst.mockResolvedValue(undefined);

      const result = await service.get({
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
      });

      expect(result).toEqual({
        id: null,
        items: [],
        subtotalCents: 0,
        itemCount: 0,
        expiresAt: null,
      });
    });

    it("returns empty cart shape when cartId is null", async () => {
      mockCartFindFirst.mockResolvedValue({ ...cartRow, id: null });
      // enrichCart gets called with null cartId → early return
      const result = await service.get({
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
      });

      expect(result.id).toBeNull();
      expect(result.items).toEqual([]);
    });
  });

  // ─── addItem ──────────────────────────────────────────────────────────────

  describe("addItem", () => {
    it("throws NotFoundException when variant is not found", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([], true)); // variant query returns []

      await expect(
        service.addItem({ storeId: STORE_ID, sessionToken: SESSION_TOKEN }, VARIANT_ID, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when variant is inactive", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([{ ...variantRow, isActive: false }], true));

      await expect(
        service.addItem({ storeId: STORE_ID, sessionToken: SESSION_TOKEN }, VARIANT_ID, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when product status is not active", async () => {
      mockSelectFn.mockReturnValueOnce(
        selectChain([{ ...variantRow, productStatus: "draft" }], true),
      );

      await expect(
        service.addItem({ storeId: STORE_ID, sessionToken: SESSION_TOKEN }, VARIANT_ID, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when goesLiveAt is in the future", async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
      mockSelectFn.mockReturnValueOnce(selectChain([{ ...variantRow, goesLiveAt: future }], true));

      await expect(
        service.addItem({ storeId: STORE_ID, sessionToken: SESSION_TOKEN }, VARIANT_ID, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when cart already has 50 items and item is new", async () => {
      // 1. variant select (valid)
      mockSelectFn
        .mockReturnValueOnce(selectChain([variantRow], true))
        // 2. count select — returns 50
        .mockReturnValueOnce(selectChain([{ count: 50 }]));

      // findCart → returns existing cart
      mockCartFindFirst.mockResolvedValue(cartRow);
      // cartItemsTable.findFirst (existing item check) → null
      mockCartItemFindFirst.mockResolvedValue(null);

      await expect(
        service.addItem({ storeId: STORE_ID, sessionToken: SESSION_TOKEN }, VARIANT_ID, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates a new cart when none exists, then inserts the item", async () => {
      const newCart = { ...cartRow, id: CART_ID };

      // 1. variant select (valid)
      mockSelectFn
        .mockReturnValueOnce(selectChain([variantRow], true))
        // 2. count select
        .mockReturnValueOnce(selectChain([{ count: 0 }]))
        // 3. enrichCart rows (inner join select)
        .mockReturnValueOnce(selectChain([enrichedItemRow], true));

      // findCart → no cart; then enrichCart cartsTable.findFirst
      mockCartFindFirst
        .mockResolvedValueOnce(undefined) // findCart
        .mockResolvedValueOnce(newCart); // enrichCart

      // Insert new cart
      mockInsertFn
        .mockReturnValueOnce(insertChain([newCart])) // insert cart
        .mockReturnValueOnce(insertNoReturningChain()); // insert cart item

      // cartItemsTable.findFirst → no existing item
      mockCartItemFindFirst.mockResolvedValue(null);

      // update cartsTable expiry
      mockUpdateFn.mockReturnValue(updateNoReturningChain());

      // selectDistinctOn for images
      mockSelectDistinctOnFn.mockReturnValueOnce(selectDistinctOnChain([]));

      const result = await service.addItem(
        { storeId: STORE_ID, sessionToken: SESSION_TOKEN },
        VARIANT_ID,
        2,
      );

      expect(result.id).toBe(CART_ID);
    });
  });

  // ─── updateItem ───────────────────────────────────────────────────────────

  describe("updateItem", () => {
    it("throws NotFoundException when cart does not exist", async () => {
      mockCartFindFirst.mockResolvedValue(undefined);

      await expect(
        service.updateItem({ storeId: STORE_ID, sessionToken: SESSION_TOKEN }, VARIANT_ID, 3),
      ).rejects.toThrow(NotFoundException);
    });

    it("deletes the item when quantity is 0", async () => {
      mockCartFindFirst.mockResolvedValueOnce(cartRow).mockResolvedValueOnce(cartRow);
      mockDeleteFn.mockReturnValueOnce(deleteChain());
      mockUpdateFn.mockReturnValue(updateNoReturningChain());
      mockSelectFn.mockReturnValueOnce(selectChain([], true));
      mockSelectDistinctOnFn.mockReturnValueOnce(selectDistinctOnChain([]));

      // Should not throw
      await service.updateItem({ storeId: STORE_ID, sessionToken: SESSION_TOKEN }, VARIANT_ID, 0);

      expect(mockDeleteFn).toHaveBeenCalledTimes(1);
    });

    it("throws NotFoundException when item is not in the cart (quantity > 0, no row returned)", async () => {
      mockCartFindFirst.mockResolvedValue(cartRow);
      mockUpdateFn.mockReturnValue(updateChain([])); // no rows returned

      await expect(
        service.updateItem({ storeId: STORE_ID, sessionToken: SESSION_TOKEN }, VARIANT_ID, 3),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── removeItem ───────────────────────────────────────────────────────────

  describe("removeItem", () => {
    it("throws NotFoundException when cart does not exist", async () => {
      mockCartFindFirst.mockResolvedValue(undefined);

      await expect(
        service.removeItem({ storeId: STORE_ID, sessionToken: SESSION_TOKEN }, VARIANT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it("deletes the item and updates expiry when cart exists", async () => {
      mockCartFindFirst
        .mockResolvedValueOnce(cartRow) // findCart
        .mockResolvedValueOnce(cartRow); // enrichCart

      mockDeleteFn.mockReturnValueOnce(deleteChain());
      mockUpdateFn.mockReturnValue(updateNoReturningChain());
      mockSelectFn.mockReturnValueOnce(selectChain([], true));
      mockSelectDistinctOnFn.mockReturnValueOnce(selectDistinctOnChain([]));

      await service.removeItem({ storeId: STORE_ID, sessionToken: SESSION_TOKEN }, VARIANT_ID);

      expect(mockDeleteFn).toHaveBeenCalledTimes(1);
      expect(mockUpdateFn).toHaveBeenCalledTimes(1);
    });
  });

  // ─── merge ────────────────────────────────────────────────────────────────

  describe("merge", () => {
    it("returns undefined without any DB writes when there is no anon cart", async () => {
      mockCartFindFirst.mockResolvedValueOnce(undefined); // anonCart not found

      const result = await service.merge(STORE_ID, SESSION_TOKEN, USER_ID);

      expect(result).toBeUndefined();
      expect(mockUpdateFn).not.toHaveBeenCalled();
      expect(mockInsertFn).not.toHaveBeenCalled();
      expect(mockDeleteFn).not.toHaveBeenCalled();
    });

    it("reassigns the anon cart to the userId when user has no cart", async () => {
      const anonCart = {
        id: ANON_CART_ID,
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
        userId: null,
      };

      mockCartFindFirst
        .mockResolvedValueOnce(anonCart) // anonCart found
        .mockResolvedValueOnce(undefined); // userCart not found

      mockUpdateFn.mockReturnValue(updateNoReturningChain());

      await service.merge(STORE_ID, SESSION_TOKEN, USER_ID);

      const setArg = mockUpdateFn.mock.results[0].value.set.mock.calls[0][0];
      expect(setArg).toEqual({ userId: USER_ID, sessionToken: null });
    });

    it("merges items and deletes the anon cart when both carts exist", async () => {
      const anonCart = {
        id: ANON_CART_ID,
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
        userId: null,
      };
      const userCart = { id: USER_CART_ID, storeId: STORE_ID, sessionToken: null, userId: USER_ID };

      const anonItem = { id: "item-1", cartId: ANON_CART_ID, variantId: VARIANT_ID, quantity: 2 };

      mockCartFindFirst
        .mockResolvedValueOnce(anonCart) // anonCart
        .mockResolvedValueOnce(userCart); // userCart

      mockCartItemFindMany.mockResolvedValueOnce([anonItem]);

      // No matching item in user cart
      mockCartItemFindFirst.mockResolvedValueOnce(null);

      mockInsertFn.mockReturnValueOnce(insertNoReturningChain());
      mockDeleteFn.mockReturnValueOnce(deleteChain());

      await service.merge(STORE_ID, SESSION_TOKEN, USER_ID);

      expect(mockInsertFn).toHaveBeenCalledTimes(1);
      expect(mockDeleteFn).toHaveBeenCalledTimes(1);
    });

    it("sums quantities when the same variant exists in both carts", async () => {
      const anonCart = {
        id: ANON_CART_ID,
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
        userId: null,
      };
      const userCart = { id: USER_CART_ID, storeId: STORE_ID, sessionToken: null, userId: USER_ID };

      const anonItem = {
        id: "item-anon",
        cartId: ANON_CART_ID,
        variantId: VARIANT_ID,
        quantity: 3,
      };
      const userItem = {
        id: "item-user",
        cartId: USER_CART_ID,
        variantId: VARIANT_ID,
        quantity: 2,
      };

      mockCartFindFirst.mockResolvedValueOnce(anonCart).mockResolvedValueOnce(userCart);

      mockCartItemFindMany.mockResolvedValueOnce([anonItem]);
      mockCartItemFindFirst.mockResolvedValueOnce(userItem);

      const mockSet = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ ...userItem, quantity: 5 }]),
        }),
      });
      mockUpdateFn.mockReturnValue({ set: mockSet });
      mockDeleteFn.mockReturnValueOnce(deleteChain());

      await service.merge(STORE_ID, SESSION_TOKEN, USER_ID);

      expect(mockSet).toHaveBeenCalledWith({ quantity: 5 }); // 3 + 2
      expect(mockDeleteFn).toHaveBeenCalledTimes(1);
    });
  });
});
