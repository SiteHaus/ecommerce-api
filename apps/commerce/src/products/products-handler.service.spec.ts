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

describe("ProductsHandlerService — product.published webhook", () => {
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

    it("does not dispatch when an already-active product is edited", async () => {
      findFirst.mockResolvedValue(product({ status: "active" }));
      updateReturning.mockResolvedValue([product({ status: "active", name: "Renamed" })]);

      await service.update({ id: PRODUCT_ID, storeId: STORE_ID, name: "Renamed" } as any);

      expect(webhooksAdd).not.toHaveBeenCalled();
    });

    it("does not dispatch when a product is unpublished", async () => {
      findFirst.mockResolvedValue(product({ status: "active" }));
      updateReturning.mockResolvedValue([product({ status: "draft" })]);

      await service.update({ id: PRODUCT_ID, storeId: STORE_ID, status: "draft" } as any);

      expect(webhooksAdd).not.toHaveBeenCalled();
    });

    it("does not dispatch when a draft is scheduled for later", async () => {
      const future = new Date(Date.now() + 86_400_000).toISOString();
      findFirst.mockResolvedValue(product({ status: "draft" }));
      updateReturning.mockResolvedValue([product({ status: "scheduled", goesLiveAt: future })]);

      await service.update({ id: PRODUCT_ID, storeId: STORE_ID, goesLiveAt: future } as any);

      expect(webhooksAdd).not.toHaveBeenCalled();
    });
  });
});
