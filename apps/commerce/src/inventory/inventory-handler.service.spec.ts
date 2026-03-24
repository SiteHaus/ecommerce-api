import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DB_TOKEN, AuditService } from "@sitehaus-ecom/shared";
import { InventoryHandlerService } from "./inventory-handler.service";

const VARIANT_ID = "variant-uuid-1";
const STORE_ID = "store-uuid-1";

// ─── helpers ──────────────────────────────────────────────────────────────────

function selectChain(resolveValue: any[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(resolveValue),
      }),
    }),
  };
}

function updateChain(returning: any[]) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(returning),
      }),
    }),
  };
}

// ─── fixtures ────────────────────────────────────────────────────────────────

const variant = { id: VARIANT_ID, storeId: STORE_ID, name: "Default" };

const invRow = {
  variantId: VARIANT_ID,
  stock: 100,
  reserved: 10,
  allowBackorder: false,
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

const storeRow = { reservationTtlMinutes: 30 };

describe("InventoryHandlerService", () => {
  let service: InventoryHandlerService;
  let mockSelectFn: jest.Mock;
  let mockVariantFindFirst: jest.Mock;
  let mockAuditLog: jest.Mock;

  beforeEach(async () => {
    mockSelectFn = jest.fn();
    mockVariantFindFirst = jest.fn();
    mockAuditLog = jest.fn().mockResolvedValue(undefined);

    const mockDb = {
      select: mockSelectFn,
      update: jest.fn(),
      query: {
        productVariantsTable: {
          findFirst: mockVariantFindFirst,
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryHandlerService,
        { provide: DB_TOKEN, useValue: mockDb },
        { provide: AuditService, useValue: { log: mockAuditLog } },
      ],
    }).compile();

    service = module.get(InventoryHandlerService);
    // Expose db for update mocking per test
    (service as any).db = mockDb;
  });

  afterEach(() => jest.clearAllMocks());

  // ─── get ──────────────────────────────────────────────────────────────────

  describe("get", () => {
    it("returns the correct shape with available = stock - reserved", async () => {
      mockVariantFindFirst.mockResolvedValue(variant);
      mockSelectFn
        .mockReturnValueOnce(selectChain([invRow]))
        .mockReturnValueOnce(selectChain([storeRow]));

      const result = await service.get(VARIANT_ID, STORE_ID);

      expect(result).toEqual({
        variantId: VARIANT_ID,
        stock: 100,
        reserved: 10,
        available: 90,
        allowBackorder: false,
        reservationTtlMinutes: 30,
        updatedAt: invRow.updatedAt,
      });
    });

    it("throws NotFoundException when variant is not found", async () => {
      mockVariantFindFirst.mockResolvedValue(undefined);

      await expect(service.get(VARIANT_ID, STORE_ID)).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when inventory record is not found", async () => {
      mockVariantFindFirst.mockResolvedValue(variant);
      mockSelectFn.mockReturnValueOnce(selectChain([]));

      await expect(service.get(VARIANT_ID, STORE_ID)).rejects.toThrow(NotFoundException);
    });

    it("defaults reservationTtlMinutes to 15 when store row is not found", async () => {
      mockVariantFindFirst.mockResolvedValue(variant);
      mockSelectFn.mockReturnValueOnce(selectChain([invRow])).mockReturnValueOnce(selectChain([]));

      const result = await service.get(VARIANT_ID, STORE_ID);

      expect(result.reservationTtlMinutes).toBe(15);
    });
  });

  // ─── adjust ───────────────────────────────────────────────────────────────

  describe("adjust", () => {
    beforeEach(() => {
      // Provide a fresh db mock that also exposes update
      mockVariantFindFirst.mockResolvedValue(variant);
    });

    it("happy path: updates inventory and returns the correct shape", async () => {
      const updatedRow = { ...invRow, stock: 200 };
      mockSelectFn
        .mockReturnValueOnce(selectChain([invRow]))
        .mockReturnValueOnce(selectChain([storeRow]));
      (service as any).db.update = jest.fn().mockReturnValue(updateChain([updatedRow]));

      const result = await service.adjust(VARIANT_ID, STORE_ID, { stock: 200 });

      expect(result).toEqual({
        variantId: VARIANT_ID,
        stock: 200,
        reserved: 10,
        available: 190,
        allowBackorder: false,
        reservationTtlMinutes: 30,
        updatedAt: updatedRow.updatedAt,
      });
    });

    it("calls audit.log with correct meta containing from and to stock values", async () => {
      const updatedRow = { ...invRow, stock: 200 };
      mockSelectFn
        .mockReturnValueOnce(selectChain([invRow]))
        .mockReturnValueOnce(selectChain([storeRow]));
      (service as any).db.update = jest.fn().mockReturnValue(updateChain([updatedRow]));

      await service.adjust(VARIANT_ID, STORE_ID, { stock: 200 });

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: STORE_ID,
          action: "inventory.adjusted",
          targetType: "variant",
          targetId: VARIANT_ID,
          meta: { from: invRow.stock, to: updatedRow.stock },
        }),
      );
    });

    it("throws BadRequestException when new stock is less than current reserved", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([invRow])); // invRow.reserved = 10

      await expect(service.adjust(VARIANT_ID, STORE_ID, { stock: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("BadRequestException message includes the reserved count", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([invRow]));

      await expect(service.adjust(VARIANT_ID, STORE_ID, { stock: 5 })).rejects.toThrow("10");
    });

    it("throws NotFoundException when variant is not found", async () => {
      mockVariantFindFirst.mockResolvedValue(undefined);

      await expect(service.adjust(VARIANT_ID, STORE_ID, { stock: 50 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NotFoundException when inventory record is not found", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([]));

      await expect(service.adjust(VARIANT_ID, STORE_ID, { stock: 50 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("allowBackorder-only update still calls update and audit", async () => {
      const updatedRow = { ...invRow, allowBackorder: true };
      mockSelectFn
        .mockReturnValueOnce(selectChain([invRow]))
        .mockReturnValueOnce(selectChain([storeRow]));
      const mockUpdate = jest.fn().mockReturnValue(updateChain([updatedRow]));
      (service as any).db.update = mockUpdate;

      const result = await service.adjust(VARIANT_ID, STORE_ID, {
        allowBackorder: true,
      });

      expect(result.allowBackorder).toBe(true);
      expect(mockAuditLog).toHaveBeenCalledTimes(1);
    });

    it("defaults reservationTtlMinutes to 15 when store row is not found", async () => {
      const updatedRow = { ...invRow, stock: 50 };
      mockSelectFn.mockReturnValueOnce(selectChain([invRow])).mockReturnValueOnce(selectChain([]));
      (service as any).db.update = jest.fn().mockReturnValue(updateChain([updatedRow]));

      const result = await service.adjust(VARIANT_ID, STORE_ID, { stock: 50 });

      expect(result.reservationTtlMinutes).toBe(15);
    });
  });
});
