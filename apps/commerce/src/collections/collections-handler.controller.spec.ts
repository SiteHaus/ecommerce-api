import { Test, TestingModule } from "@nestjs/testing";
import { CollectionsHandlerController } from "./collections-handler.controller";
import { CollectionsHandlerService } from "./collections-handler.service";

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

describe("CollectionsHandlerController", () => {
  let controller: CollectionsHandlerController;
  let mockService: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    verify: jest.Mock;
    reorder: jest.Mock;
    list: jest.Mock;
    getCollection: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      verify: jest.fn(),
      reorder: jest.fn(),
      list: jest.fn(),
      getCollection: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionsHandlerController],
      providers: [{ provide: CollectionsHandlerService, useValue: mockService }],
    }).compile();

    controller = module.get(CollectionsHandlerController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe("create", () => {
    it("calls service.create with payload", async () => {
      mockService.create.mockResolvedValue(collectionRow);

      await controller.create({
        storeId: STORE_ID,
        name: "Summer Sale",
        slug: "summer-sale",
        sortOrder: 0,
        goesLiveAt: null,
      });

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: STORE_ID, slug: "summer-sale" }),
      );
    });

    it("returns the service result unchanged", async () => {
      mockService.create.mockResolvedValue(collectionRow);

      const result = await controller.create({
        storeId: STORE_ID,
        name: "Summer Sale",
        slug: "summer-sale",
        sortOrder: 0,
        goesLiveAt: null,
      });

      expect(result).toEqual(collectionRow);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe("update", () => {
    it("calls service.update with payload", async () => {
      const updated = { ...collectionRow, name: "Updated Name" };
      mockService.update.mockResolvedValue(updated);

      await controller.update({
        storeId: STORE_ID,
        collectionId: COLLECTION_ID,
        name: "Updated Name",
      });

      expect(mockService.update).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: STORE_ID, collectionId: COLLECTION_ID }),
      );
    });

    it("returns the service result unchanged", async () => {
      const updated = { ...collectionRow, name: "Updated Name" };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update({
        storeId: STORE_ID,
        collectionId: COLLECTION_ID,
        name: "Updated Name",
      });

      expect(result).toEqual(updated);
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("calls service.delete with payload", async () => {
      mockService.delete.mockResolvedValue({ id: COLLECTION_ID });

      await controller.delete({
        id: COLLECTION_ID,
        storeId: STORE_ID,
        collectionId: COLLECTION_ID,
      });

      expect(mockService.delete).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: STORE_ID, collectionId: COLLECTION_ID }),
      );
    });

    it("returns the deleted id", async () => {
      mockService.delete.mockResolvedValue({ message: "Collection has been deleted!" });

      const result = await controller.delete({
        id: COLLECTION_ID,
        storeId: STORE_ID,
        collectionId: COLLECTION_ID,
      });

      expect(result).toEqual({ message: "Collection has been deleted!" });
    });
  });

  // ─── addProduct ───────────────────────────────────────────────────────────

  describe("addProduct", () => {
    it("calls service.verify with payload", async () => {
      mockService.verify.mockResolvedValue(undefined);

      await controller.addProduct({
        storeId: STORE_ID,
        collectionId: COLLECTION_ID,
        productId: PRODUCT_ID,
      });

      expect(mockService.verify).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: STORE_ID,
          collectionId: COLLECTION_ID,
          productId: PRODUCT_ID,
        }),
      );
    });
  });

  // ─── reorder ──────────────────────────────────────────────────────────────

  describe("reorder", () => {
    it("calls service.reorder with payload", async () => {
      mockService.reorder.mockResolvedValue(undefined);

      const payload = {
        storeId: STORE_ID,
        collectionId: COLLECTION_ID,
        items: [
          { productId: "prod-1", sortOrder: 0 },
          { productId: "prod-2", sortOrder: 1 },
        ],
      };

      await controller.reorder(payload);

      expect(mockService.reorder).toHaveBeenCalledWith(
        expect.objectContaining({ collectionId: COLLECTION_ID, items: payload.items }),
      );
    });
  });

  // ─── list ─────────────────────────────────────────────────────────────────

  // ─── list ─────────────────────────────────────────────────────────────────
  describe("list", () => {
    it("calls service.list with storeId", async () => {
      mockService.list.mockResolvedValue([collectionRow]);

      await controller.list({ storeId: STORE_ID });

      expect(mockService.list).toHaveBeenCalledWith(STORE_ID);
    });

    it("returns the service result unchanged", async () => {
      mockService.list.mockResolvedValue([collectionRow]);

      const result = await controller.list({ storeId: STORE_ID });

      expect(result).toEqual([collectionRow]);
    });
  });

  // ─── getCollection ────────────────────────────────────────────────────────
  describe("getCollection", () => {
    it("calls service.getCollection with storeId and collectionId", async () => {
      mockService.getCollection.mockResolvedValue(collectionRow);

      await controller.getCollection({ storeId: STORE_ID, collectionId: COLLECTION_ID });

      expect(mockService.getCollection).toHaveBeenCalledWith(STORE_ID, COLLECTION_ID);
    });

    it("returns the service result unchanged", async () => {
      mockService.getCollection.mockResolvedValue(collectionRow);

      const result = await controller.getCollection({
        storeId: STORE_ID,
        collectionId: COLLECTION_ID,
      });

      expect(result).toEqual(collectionRow);
    });
  });
});
