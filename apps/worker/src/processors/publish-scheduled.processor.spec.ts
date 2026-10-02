import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { PublishScheduledProcessor } from "./publish-scheduled.processor";

const flush = () => new Promise((r) => setImmediate(r));

describe("PublishScheduledProcessor", () => {
  let processor: PublishScheduledProcessor;
  let db: { execute: jest.Mock };
  let webhooksAdd: jest.Mock;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    db = { execute: jest.fn() };
    webhooksAdd = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishScheduledProcessor,
        { provide: DB_TOKEN, useValue: db },
        { provide: getQueueToken("ecom-webhooks"), useValue: { add: webhooksAdd } },
      ],
    }).compile();

    processor = module.get(PublishScheduledProcessor);
    logSpy = jest.spyOn((processor as any).logger, "log").mockImplementation(() => {});
  });

  afterEach(() => jest.clearAllMocks());

  it("ignores jobs that are not catalog.publish-scheduled", async () => {
    await processor.process({ name: "something.else", data: {} } as any);

    expect(db.execute).not.toHaveBeenCalled();
    expect(webhooksAdd).not.toHaveBeenCalled();
  });

  it("dispatches product.published for each product that went live", async () => {
    db.execute.mockResolvedValue({
      rowCount: 2,
      rows: [
        { id: "p1", store_id: "s1", name: "Aspen at Dawn" },
        { id: "p2", store_id: "s2", name: "Night Lake" },
      ],
    });

    await processor.process({ name: "catalog.publish-scheduled", data: {} } as any);

    expect(logSpy).toHaveBeenCalledWith("Published 2 scheduled product(s)");
    expect(webhooksAdd).toHaveBeenCalledTimes(2);
    expect(webhooksAdd).toHaveBeenCalledWith("webhook.dispatch", {
      storeId: "s1",
      event: "product.published",
      data: { productId: "p1", name: "Aspen at Dawn" },
    });
    expect(webhooksAdd).toHaveBeenCalledWith("webhook.dispatch", {
      storeId: "s2",
      event: "product.published",
      data: { productId: "p2", name: "Night Lake" },
    });
  });

  it("does nothing when no scheduled products are due", async () => {
    db.execute.mockResolvedValue({ rowCount: 0, rows: [] });

    await processor.process({ name: "catalog.publish-scheduled", data: {} } as any);

    expect(logSpy).not.toHaveBeenCalled();
    expect(webhooksAdd).not.toHaveBeenCalled();
  });

  it("does not fail the job when a webhook can't be enqueued", async () => {
    db.execute.mockResolvedValue({ rowCount: 1, rows: [{ id: "p1", store_id: "s1", name: "A" }] });
    webhooksAdd.mockRejectedValue(new Error("redis down"));

    await expect(
      processor.process({ name: "catalog.publish-scheduled", data: {} } as any),
    ).resolves.toBeUndefined();
    await flush();
  });
});
