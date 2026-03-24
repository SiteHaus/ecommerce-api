import { Test, TestingModule } from "@nestjs/testing";
import { InventoryHandlerController } from "./inventory-handler.controller";
import { InventoryHandlerService } from "./inventory-handler.service";

const VARIANT_ID = "variant-uuid-1";
const STORE_ID = "store-uuid-1";

const inventoryRow = {
  variantId: VARIANT_ID,
  stock: 100,
  reserved: 10,
  available: 90,
  allowBackorder: false,
  reservationTtlMinutes: 15,
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

describe("InventoryHandlerController", () => {
  let controller: InventoryHandlerController;
  let mockService: { get: jest.Mock; adjust: jest.Mock };

  beforeEach(async () => {
    mockService = {
      get: jest.fn(),
      adjust: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryHandlerController],
      providers: [{ provide: InventoryHandlerService, useValue: mockService }],
    }).compile();

    controller = module.get(InventoryHandlerController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── inventory.get ──────────────────────────────────────────────────────────

  describe("get", () => {
    it("calls service.get with variantId and storeId from payload", async () => {
      mockService.get.mockResolvedValue(inventoryRow);

      await controller.get({ variantId: VARIANT_ID, storeId: STORE_ID });

      expect(mockService.get).toHaveBeenCalledWith(VARIANT_ID, STORE_ID);
    });

    it("returns the service result unchanged", async () => {
      mockService.get.mockResolvedValue(inventoryRow);

      const result = await controller.get({
        variantId: VARIANT_ID,
        storeId: STORE_ID,
      });

      expect(result).toEqual(inventoryRow);
    });
  });

  // ─── inventory.adjust ───────────────────────────────────────────────────────

  describe("adjust", () => {
    it("calls service.adjust with variantId, storeId, and stock update", async () => {
      mockService.adjust.mockResolvedValue({ ...inventoryRow, stock: 10 });

      await controller.adjust({
        variantId: VARIANT_ID,
        storeId: STORE_ID,
        stock: 10,
      });

      expect(mockService.adjust).toHaveBeenCalledWith(VARIANT_ID, STORE_ID, {
        stock: 10,
      });
    });

    it("passes allowBackorder update correctly, excluding variantId and storeId", async () => {
      mockService.adjust.mockResolvedValue({
        ...inventoryRow,
        allowBackorder: true,
      });

      await controller.adjust({
        variantId: VARIANT_ID,
        storeId: STORE_ID,
        allowBackorder: true,
      });

      expect(mockService.adjust).toHaveBeenCalledWith(VARIANT_ID, STORE_ID, {
        allowBackorder: true,
      });
    });

    it("passes both stock and allowBackorder when both are provided", async () => {
      mockService.adjust.mockResolvedValue({
        ...inventoryRow,
        stock: 50,
        allowBackorder: true,
      });

      await controller.adjust({
        variantId: VARIANT_ID,
        storeId: STORE_ID,
        stock: 50,
        allowBackorder: true,
      });

      expect(mockService.adjust).toHaveBeenCalledWith(VARIANT_ID, STORE_ID, {
        stock: 50,
        allowBackorder: true,
      });
    });

    it("returns the service result unchanged", async () => {
      const updated = { ...inventoryRow, stock: 10 };
      mockService.adjust.mockResolvedValue(updated);

      const result = await controller.adjust({
        variantId: VARIANT_ID,
        storeId: STORE_ID,
        stock: 10,
      });

      expect(result).toEqual(updated);
    });
  });
});
