import { Test, TestingModule } from "@nestjs/testing";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { OrderExpireProcessor } from "./order-expire.processor";

describe("OrderExpireProcessor", () => {
  let processor: OrderExpireProcessor;
  let db: { execute: jest.Mock };
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    db = { execute: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrderExpireProcessor, { provide: DB_TOKEN, useValue: db }],
    }).compile();
    processor = module.get(OrderExpireProcessor);
    logSpy = jest.spyOn((processor as any).logger, "log").mockImplementation(() => {});
  });

  afterEach(() => jest.clearAllMocks());

  it("ignores jobs that are not order.expire", async () => {
    await processor.process({ name: "cart.expire", data: {} } as any);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("calls db.execute when job is order.expire", async () => {
    db.execute.mockResolvedValue({ rowCount: 0 });
    await processor.process({ name: "order.expire", data: {} } as any);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it("logs when abandoned orders are cancelled", async () => {
    db.execute.mockResolvedValue({ rowCount: 3 });
    await processor.process({ name: "order.expire", data: {} } as any);
    expect(logSpy).toHaveBeenCalledWith("Cancelled 3 abandoned orders");
  });

  it("does not log when nothing is cancelled", async () => {
    db.execute.mockResolvedValue({ rowCount: 0 });
    await processor.process({ name: "order.expire", data: {} } as any);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
