import { Test, TestingModule } from "@nestjs/testing";
import { CartHandlerController } from "./cart-handler.controller";
import { CartHandlerService } from "./cart-handler.service";

const STORE_ID = "store-uuid-1";
const SESSION_TOKEN = "session-token-abc";
const USER_ID = "user-uuid-1";
const VARIANT_ID = "variant-uuid-1";

const emptyCart = {
  id: null,
  items: [],
  subtotalCents: 0,
  itemCount: 0,
  expiresAt: null,
};

const cartWithItem = {
  id: "cart-uuid-1",
  items: [
    {
      variantId: VARIANT_ID,
      productId: "product-uuid-1",
      productName: "Test Product",
      variantName: "Default",
      sku: "SKU-001",
      priceCents: 2000,
      compareAtCents: null,
      primaryImageUrl: null,
      quantity: 2,
      lineTotalCents: 4000,
      availability: "in_stock",
    },
  ],
  subtotalCents: 4000,
  itemCount: 2,
  expiresAt: "2024-01-08T00:00:00.000Z",
};

describe("CartHandlerController", () => {
  let controller: CartHandlerController;
  let mockService: {
    get: jest.Mock;
    addItem: jest.Mock;
    updateItem: jest.Mock;
    removeItem: jest.Mock;
    merge: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      get: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      merge: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartHandlerController],
      providers: [{ provide: CartHandlerService, useValue: mockService }],
    }).compile();

    controller = module.get(CartHandlerController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── cart.get ───────────────────────────────────────────────────────────────

  describe("get", () => {
    it("delegates the full identity object to service.get", async () => {
      mockService.get.mockResolvedValue(emptyCart);
      const identity = {
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
        userId: USER_ID,
      };

      await controller.get(identity);

      expect(mockService.get).toHaveBeenCalledWith(identity);
    });

    it("returns the service result unchanged", async () => {
      mockService.get.mockResolvedValue(emptyCart);

      const result = await controller.get({
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
      });

      expect(result).toEqual(emptyCart);
    });

    it("works with anonymous identity (no userId)", async () => {
      mockService.get.mockResolvedValue(emptyCart);
      const identity = { storeId: STORE_ID, sessionToken: SESSION_TOKEN };

      await controller.get(identity);

      expect(mockService.get).toHaveBeenCalledWith(identity);
    });
  });

  // ─── cart.addItem ────────────────────────────────────────────────────────────

  describe("addItem", () => {
    it("passes identity, variantId, and quantity correctly to service.addItem", async () => {
      mockService.addItem.mockResolvedValue(cartWithItem);

      await controller.addItem({
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
        variantId: VARIANT_ID,
        quantity: 2,
      });

      expect(mockService.addItem).toHaveBeenCalledWith(
        { storeId: STORE_ID, sessionToken: SESSION_TOKEN },
        VARIANT_ID,
        2,
      );
    });

    it("extracts variantId and quantity from the payload leaving identity intact", async () => {
      mockService.addItem.mockResolvedValue(cartWithItem);

      await controller.addItem({
        storeId: STORE_ID,
        userId: USER_ID,
        variantId: VARIANT_ID,
        quantity: 5,
      });

      const [identity, varId, qty] = mockService.addItem.mock.calls[0];
      expect(identity).toEqual({ storeId: STORE_ID, userId: USER_ID });
      expect(varId).toBe(VARIANT_ID);
      expect(qty).toBe(5);
    });

    it("returns the service result unchanged", async () => {
      mockService.addItem.mockResolvedValue(cartWithItem);

      const result = await controller.addItem({
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
        variantId: VARIANT_ID,
        quantity: 2,
      });

      expect(result).toEqual(cartWithItem);
    });
  });

  // ─── cart.updateItem ─────────────────────────────────────────────────────────

  describe("updateItem", () => {
    it("extracts variantId from payload and passes quantity to service.updateItem", async () => {
      mockService.updateItem.mockResolvedValue(cartWithItem);

      await controller.updateItem({
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
        variantId: VARIANT_ID,
        quantity: 3,
      });

      expect(mockService.updateItem).toHaveBeenCalledWith(
        { storeId: STORE_ID, sessionToken: SESSION_TOKEN },
        VARIANT_ID,
        3,
      );
    });

    it("returns the service result unchanged", async () => {
      mockService.updateItem.mockResolvedValue(cartWithItem);

      const result = await controller.updateItem({
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
        variantId: VARIANT_ID,
        quantity: 3,
      });

      expect(result).toEqual(cartWithItem);
    });
  });

  // ─── cart.removeItem ─────────────────────────────────────────────────────────

  describe("removeItem", () => {
    it("extracts variantId and passes identity to service.removeItem", async () => {
      mockService.removeItem.mockResolvedValue(emptyCart);

      await controller.removeItem({
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
        variantId: VARIANT_ID,
      });

      expect(mockService.removeItem).toHaveBeenCalledWith(
        { storeId: STORE_ID, sessionToken: SESSION_TOKEN },
        VARIANT_ID,
      );
    });

    it("returns the service result unchanged", async () => {
      mockService.removeItem.mockResolvedValue(emptyCart);

      const result = await controller.removeItem({
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
        variantId: VARIANT_ID,
      });

      expect(result).toEqual(emptyCart);
    });
  });

  // ─── cart.merge ──────────────────────────────────────────────────────────────

  describe("merge", () => {
    it("calls service.merge with storeId, sessionToken, and userId", async () => {
      mockService.merge.mockResolvedValue(undefined);

      await controller.merge({
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
        userId: USER_ID,
      });

      expect(mockService.merge).toHaveBeenCalledWith(STORE_ID, SESSION_TOKEN, USER_ID);
    });

    it("returns the service result unchanged", async () => {
      mockService.merge.mockResolvedValue(undefined);

      const result = await controller.merge({
        storeId: STORE_ID,
        sessionToken: SESSION_TOKEN,
        userId: USER_ID,
      });

      expect(result).toBeUndefined();
    });
  });
});
