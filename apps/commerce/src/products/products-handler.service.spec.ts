import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { DB_TOKEN, AuditService } from "@sitehaus-ecom/shared";
import { ProductsHandlerService } from "./products-handler.service";

const STORE_ID = "store-uuid-1";
const PRODUCT_ID = "product-uuid-1";

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_ID,
    storeId: STORE_ID,
    name: "Aspen at Dawn",
    status: "draft",
    goesLiveAt: null,
    ...overrides,
  };
}

const flush = () => new Promise((r) => setImmediate(r));

describe("ProductsHandlerService — product webhooks", () => {
  let service: ProductsHandlerService;
  let insertReturning: jest.Mock;
  let insertValues: jest.Mock;
  let updateReturning: jest.Mock;
  let findFirst: jest.Mock;
  let webhooksAdd: jest.Mock;

  beforeEach(async () => {
    insertReturning = jest.fn();
    insertValues = jest.fn().mockReturnValue({ returning: insertReturning });
    updateReturning = jest.fn();
    findFirst = jest.fn();
    webhooksAdd = jest.fn().mockResolvedValue(undefined);

    const mockDb = {
      insert: jest.fn().mockReturnValue({ values: insertValues }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({ returning: updateReturning }),
        }),
      }),
      query: { productsTable: { findFirst } },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsHandlerService,
        { provide: DB_TOKEN, useValue: mockDb },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: getQueueToken("ecom-webhooks"), useValue: { add: webhooksAdd } },
      ],
    }).compile();

    service = module.get(ProductsHandlerService);
  });

  afterEach(() => jest.clearAllMocks());

  const publishedJob = {
    storeId: STORE_ID,
    event: "product.published",
    data: { productId: PRODUCT_ID, name: "Aspen at Dawn" },
  };

  const removedJob = {
    storeId: STORE_ID,
    event: "product.removed",
    data: { productId: PRODUCT_ID, name: "Aspen at Dawn" },
  };

  describe("create", () => {
    it("dispatches when the product is created active", async () => {
      insertReturning.mockResolvedValue([product({ status: "active" })]);

      await service.create({ storeId: STORE_ID, name: "Aspen at Dawn", status: "active" } as any);

      expect(webhooksAdd).toHaveBeenCalledTimes(1);
      expect(webhooksAdd).toHaveBeenCalledWith("webhook.dispatch", publishedJob);
    });

    it("does not dispatch for a draft", async () => {
      insertReturning.mockResolvedValue([product({ status: "draft" })]);

      await service.create({ storeId: STORE_ID, name: "Aspen at Dawn" } as any);

      expect(webhooksAdd).not.toHaveBeenCalled();
    });

    it("does not dispatch when a future go-live date makes it scheduled", async () => {
      const future = new Date(Date.now() + 86_400_000).toISOString();
      insertReturning.mockResolvedValue([product({ status: "scheduled", goesLiveAt: future })]);

      await service.create({
        storeId: STORE_ID,
        name: "Aspen at Dawn",
        status: "active",
        goesLiveAt: future,
      } as any);

      expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ status: "scheduled" }));
      expect(webhooksAdd).not.toHaveBeenCalled();
    });

    it("still returns the product if the webhook can't be enqueued", async () => {
      insertReturning.mockResolvedValue([product({ status: "active" })]);
      webhooksAdd.mockRejectedValue(new Error("redis down"));

      await expect(
        service.create({ storeId: STORE_ID, name: "Aspen at Dawn", status: "active" } as any),
      ).resolves.toEqual(expect.objectContaining({ id: PRODUCT_ID }));
      await flush();
    });
  });

  describe("update", () => {
    it.each(["draft", "archived"])(
      "dispatches when a product goes from %s to active",
      async (from) => {
        findFirst.mockResolvedValue(product({ status: from }));
        updateReturning.mockResolvedValue([product({ status: "active" })]);

        await service.update({ id: PRODUCT_ID, storeId: STORE_ID, status: "active" } as any);

        expect(webhooksAdd).toHaveBeenCalledTimes(1);
        expect(webhooksAdd).toHaveBeenCalledWith("webhook.dispatch", publishedJob);
      },
    );

    it("dispatches when a scheduled product whose time has passed is activated manually", async () => {
      const past = new Date(Date.now() - 60_000);
      findFirst.mockResolvedValue(product({ status: "scheduled", goesLiveAt: past }));
      updateReturning.mockResolvedValue([product({ status: "active", goesLiveAt: past })]);

      await service.update({ id: PRODUCT_ID, storeId: STORE_ID, status: "active" } as any);

      expect(webhooksAdd).toHaveBeenCalledTimes(1);
    });

    it("sends product.updated, not product.published, when an already-active product is edited", async () => {
      findFirst.mockResolvedValue(product({ status: "active" }));
      updateReturning.mockResolvedValue([product({ status: "active", name: "Renamed" })]);

      await service.update({ id: PRODUCT_ID, storeId: STORE_ID, name: "Renamed" } as any);

      expect(webhooksAdd).toHaveBeenCalledTimes(1);
      expect(webhooksAdd).toHaveBeenCalledWith("webhook.dispatch", {
        storeId: STORE_ID,
        event: "product.updated",
        data: { productId: PRODUCT_ID, name: "Renamed", status: "active" },
      });
    });

    it("sends product.updated when a product is unpublished to draft", async () => {
      findFirst.mockResolvedValue(product({ status: "active" }));
      updateReturning.mockResolvedValue([product({ status: "draft" })]);

      await service.update({ id: PRODUCT_ID, storeId: STORE_ID, status: "draft" } as any);

      expect(webhooksAdd).toHaveBeenCalledTimes(1);
      expect(webhooksAdd).toHaveBeenCalledWith(
        "webhook.dispatch",
        expect.objectContaining({
          event: "product.updated",
          data: expect.objectContaining({ status: "draft" }),
        }),
      );
    });

    it("sends product.updated when a draft is scheduled for later", async () => {
      const future = new Date(Date.now() + 86_400_000).toISOString();
      findFirst.mockResolvedValue(product({ status: "draft" }));
      updateReturning.mockResolvedValue([product({ status: "scheduled", goesLiveAt: future })]);

      await service.update({ id: PRODUCT_ID, storeId: STORE_ID, goesLiveAt: future } as any);

      expect(webhooksAdd).toHaveBeenCalledTimes(1);
      expect(webhooksAdd).toHaveBeenCalledWith(
        "webhook.dispatch",
        expect.objectContaining({ event: "product.updated" }),
      );
    });

    it("sends product.updated when an archived product is edited but stays archived", async () => {
      findFirst.mockResolvedValue(product({ status: "archived" }));
      updateReturning.mockResolvedValue([product({ status: "archived", name: "Renamed" })]);

      await service.update({ id: PRODUCT_ID, storeId: STORE_ID, name: "Renamed" } as any);

      expect(webhooksAdd).toHaveBeenCalledTimes(1);
      expect(webhooksAdd).toHaveBeenCalledWith(
        "webhook.dispatch",
        expect.objectContaining({ event: "product.updated" }),
      );
    });

    it.each(["active", "draft", "scheduled"])(
      "sends product.removed (only) when a product goes from %s to archived",
      async (from) => {
        findFirst.mockResolvedValue(product({ status: from }));
        updateReturning.mockResolvedValue([product({ status: "archived" })]);

        await service.update({ id: PRODUCT_ID, storeId: STORE_ID, status: "archived" } as any);

        expect(webhooksAdd).toHaveBeenCalledTimes(1);
        expect(webhooksAdd).toHaveBeenCalledWith("webhook.dispatch", removedJob);
      },
    );

    it("still returns the product if the webhook can't be enqueued", async () => {
      findFirst.mockResolvedValue(product({ status: "active" }));
      updateReturning.mockResolvedValue([product({ status: "active", name: "Renamed" })]);
      webhooksAdd.mockRejectedValue(new Error("redis down"));

      await expect(
        service.update({ id: PRODUCT_ID, storeId: STORE_ID, name: "Renamed" } as any),
      ).resolves.toEqual(expect.objectContaining({ id: PRODUCT_ID }));
      await flush();
    });
  });

  describe("delete", () => {
    it.each(["active", "draft", "scheduled"])(
      "sends product.removed when a %s product is deleted",
      async (from) => {
        findFirst.mockResolvedValue(product({ status: from }));

        await service.delete({ id: PRODUCT_ID, storeId: STORE_ID });

        expect(webhooksAdd).toHaveBeenCalledTimes(1);
        expect(webhooksAdd).toHaveBeenCalledWith("webhook.dispatch", removedJob);
      },
    );

    it("does not dispatch when the product was already archived", async () => {
      findFirst.mockResolvedValue(product({ status: "archived" }));

      await service.delete({ id: PRODUCT_ID, storeId: STORE_ID });

      expect(webhooksAdd).not.toHaveBeenCalled();
    });

    it("does not dispatch when the product doesn't exist", async () => {
      findFirst.mockResolvedValue(undefined);

      await expect(service.delete({ id: PRODUCT_ID, storeId: STORE_ID })).rejects.toThrow(
        "Product not found",
      );
      expect(webhooksAdd).not.toHaveBeenCalled();
    });

    it("still archives if the webhook can't be enqueued", async () => {
      findFirst.mockResolvedValue(product({ status: "active" }));
      webhooksAdd.mockRejectedValue(new Error("redis down"));

      await expect(service.delete({ id: PRODUCT_ID, storeId: STORE_ID })).resolves.toEqual({
        message: "The product was successfully archived",
      });
      await flush();
    });
  });
});
