import { Test, TestingModule } from "@nestjs/testing";
import { CollectionsHandlerService } from "./collections-handler.service";
import { DB_TOKEN, AuditService } from "@sitehaus-ecom/shared";
import { ConflictException, NotFoundException } from "@nestjs/common";

// ─── helpers ──────────────────────────────────────────────────────────────────

function selectChain(resolveValue: any[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(resolveValue),
        orderBy: jest.fn().mockResolvedValue(resolveValue),
      }),
    }),
  };
}

function insertChain(returning: any[]) {
  return {
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(returning),
      onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
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

// ─── fixtures ─────────────────────────────────────────────────────────────────

const STORE_ID = "store-uuid-1";
const COLLECTION_ID = "col-uuid-1";
const PRODUCT_ID = "prod-uuid-1";

const collectionRow = {
  id: COLLECTION_ID,
  storeId: STORE_ID,
  name: "Summer Sale",
  slug: "summer-sale",
  sortOrder: 0,
  description: null,
  goesLiveAt: null,
};

describe("CollectionsHandlerService", () => {
  let service: CollectionsHandlerService;
  let mockSelectFn: jest.Mock;
  let mockInsertFn: jest.Mock;
  let mockUpdateFn: jest.Mock;
  let mockDeleteFn: jest.Mock;
  let mockTransactionFn: jest.Mock;
  let mockAuditLog: jest.Mock;

  beforeEach(async () => {
    mockSelectFn = jest.fn();
    mockInsertFn = jest.fn();
    mockUpdateFn = jest.fn();
    mockDeleteFn = jest.fn();
    mockTransactionFn = jest.fn();
    mockAuditLog = jest.fn().mockResolvedValue(undefined);

    const mockDb = {
      select: mockSelectFn,
      insert: mockInsertFn,
      update: mockUpdateFn,
      delete: mockDeleteFn,
      transaction: mockTransactionFn,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsHandlerService,
        { provide: DB_TOKEN, useValue: mockDb },
        { provide: AuditService, useValue: { log: mockAuditLog } },
      ],
    }).compile();

    service = module.get(CollectionsHandlerService);
    (service as any).db = mockDb;
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe("create", () => {
    const payload = {
      storeId: STORE_ID,
      name: "Summer Sale",
      slug: "summer-sale",
      sortOrder: 0,
      description: undefined,
      goesLiveAt: null,
    };

    it("should create a collection", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([])); // no slug conflict
      mockInsertFn.mockReturnValueOnce(insertChain([{ id: COLLECTION_ID, ...payload }]));

      const result = await service.create(payload);

      expect(result).toMatchObject({ id: COLLECTION_ID, slug: "summer-sale" });
    });

    it("should throw ConflictException if slug is taken", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([collectionRow]));

      await expect(service.create(payload)).rejects.toThrow(ConflictException);
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe("delete", () => {
    const payload = { id: COLLECTION_ID, collectionId: COLLECTION_ID, storeId: STORE_ID };

    it("should delete a collection and return id", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([collectionRow]));
      mockDeleteFn.mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.delete(payload);

      expect(result).toEqual({ message: "Collection has been deleted!" });
    });

    it("should throw NotFoundException if collection not found", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([]));

      await expect(service.delete(payload)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe("update", () => {
    const payload = { storeId: STORE_ID, collectionId: COLLECTION_ID, name: "Updated Name" };

    it("should update and return the collection", async () => {
      const updated = { ...collectionRow, name: "Updated Name" };
      mockSelectFn.mockReturnValueOnce(selectChain([collectionRow]));
      mockUpdateFn.mockReturnValueOnce(updateChain([updated]));

      const result = await service.update(payload);

      expect(result).toMatchObject({ name: "Updated Name", id: COLLECTION_ID });
    });

    it("should throw NotFoundException if collection not found", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([]));

      await expect(service.update(payload)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── reorder ──────────────────────────────────────────────────────────────

  describe("reorder", () => {
    const payload = {
      storeId: STORE_ID,
      collectionId: COLLECTION_ID,
      items: [
        { productId: "prod-1", sortOrder: 0 },
        { productId: "prod-2", sortOrder: 1 },
      ],
    };

    it("should reorder products in a transaction", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([collectionRow]));
      mockTransactionFn.mockImplementation(async (cb) => cb((service as any).db));
      mockUpdateFn.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      await service.reorder(payload);

      expect(mockTransactionFn).toHaveBeenCalled();
    });

    it("should throw NotFoundException if collection not found", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([]));

      await expect(service.reorder(payload)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── list ─────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("should return sorted collections", async () => {
      mockSelectFn.mockReturnValueOnce(
        selectChain([collectionRow, { ...collectionRow, id: "col-2" }]),
      );

      const result = await service.list(STORE_ID);

      expect(result).toHaveLength(2);
    });

    it("should return empty array if no collections", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([]));

      const result = await service.list(STORE_ID);

      expect(result).toEqual([]);
    });
  });

  // ─── getCollection ────────────────────────────────────────────────────────

  describe("getCollection", () => {
    it("should return a collection by slug", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([collectionRow]));

      const result = await service.getCollection(STORE_ID, "summer-sale");

      expect(result).toMatchObject({ slug: "summer-sale" });
    });

    it("should throw NotFoundException if not found", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([]));

      await expect(service.getCollection(STORE_ID, "bad-slug")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── verify (addProduct) ──────────────────────────────────────────────────

  describe("verify (addProduct)", () => {
    const payload = { storeId: STORE_ID, collectionId: COLLECTION_ID, productId: PRODUCT_ID };

    it("should insert product into collection", async () => {
      mockSelectFn
        .mockReturnValueOnce(selectChain([collectionRow])) // collection check
        .mockReturnValueOnce(selectChain([{ id: PRODUCT_ID }])); // product check
      mockInsertFn.mockReturnValueOnce(insertChain([]));

      await service.verify(payload);

      expect(mockInsertFn).toHaveBeenCalled();
    });

    it("should throw NotFoundException if collection not found", async () => {
      mockSelectFn.mockReturnValueOnce(selectChain([]));

      await expect(service.verify(payload)).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if product not found", async () => {
      mockSelectFn
        .mockReturnValueOnce(selectChain([collectionRow]))
        .mockReturnValueOnce(selectChain([]));

      await expect(service.verify(payload)).rejects.toThrow(NotFoundException);
    });
  });
});
