import { Test, TestingModule } from "@nestjs/testing";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { CartExpireProcessor } from "./cart-expire.processor";

describe("CartExpireProcessor", () => {
  let processor: CartExpireProcessor;
  let db: { execute: jest.Mock };
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    db = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CartExpireProcessor, { provide: DB_TOKEN, useValue: db }],
    }).compile();

    processor = module.get(CartExpireProcessor);
    logSpy = jest.spyOn((processor as any).logger, "log").mockImplementation(() => {});
  });

  afterEach(() => jest.clearAllMocks());

  it("ignores jobs that are not cart.expire", async () => {
    await processor.process({ name: "reservation.expire", data: {} } as any);

    expect(db.execute).not.toHaveBeenCalled();
  });

  it("calls db.execute when job is cart.expire", async () => {
    db.execute.mockResolvedValue({ rowCount: 0 });

    await processor.process({ name: "cart.expire", data: {} } as any);

    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it("logs when carts are deleted", async () => {
    db.execute.mockResolvedValue({ rowCount: 5 });

    await processor.process({ name: "cart.expire", data: {} } as any);

    expect(logSpy).toHaveBeenCalledWith("Deleted 5 expired carts");
  });

  it("does not log when no carts are deleted", async () => {
    db.execute.mockResolvedValue({ rowCount: 0 });

    await processor.process({ name: "cart.expire", data: {} } as any);

    expect(logSpy).not.toHaveBeenCalled();
  });
});
