import { Test, TestingModule } from "@nestjs/testing";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { AddressRedactionProcessor } from "./address-redaction.processor";

describe("AddressRedactionProcessor", () => {
  let processor: AddressRedactionProcessor;
  let db: {
    select: jest.Mock;
    update: jest.Mock;
  };
  let logSpy: jest.SpyInstance;

  // Chainable query-builder mocks for the select() and update() paths.
  let selectRows: unknown[];
  let updateRows: unknown[];

  beforeEach(async () => {
    selectRows = [];
    updateRows = [];

    const selectChain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockImplementation(() => Promise.resolve(selectRows)),
    };
    const updateChain = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockImplementation(() => Promise.resolve(updateRows)),
    };

    db = {
      select: jest.fn().mockReturnValue(selectChain),
      update: jest.fn().mockReturnValue(updateChain),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AddressRedactionProcessor, { provide: DB_TOKEN, useValue: db }],
    }).compile();

    processor = module.get(AddressRedactionProcessor);
    logSpy = jest.spyOn((processor as any).logger, "log").mockImplementation(() => {});
  });

  afterEach(() => jest.clearAllMocks());

  it("ignores jobs that are not address.redact", async () => {
    const result = await processor.process({ name: "cart.expire", data: {} } as any);

    expect(db.select).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it("runs the redacting UPDATE for an address.redact job", async () => {
    updateRows = [{ id: "order-1" }, { id: "order-2" }];

    const result = await processor.process({ name: "address.redact", data: {} } as any);

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.select).not.toHaveBeenCalled();
    expect(result).toEqual({ redacted: 2 });
  });

  it("logs when orders are redacted", async () => {
    updateRows = [{ id: "order-1" }];

    await processor.process({ name: "address.redact", data: {} } as any);

    expect(logSpy).toHaveBeenCalledWith(
      "Redacted the street on 1 order(s) past the dispute window",
    );
  });

  it("does not log when nothing is redacted", async () => {
    updateRows = [];

    await processor.process({ name: "address.redact", data: {} } as any);

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("in dry-run mode, selects instead of updating, and changes nothing", async () => {
    selectRows = [{ id: "order-1" }, { id: "order-2" }, { id: "order-3" }];

    const result = await processor.process({
      name: "address.redact",
      data: { dryRun: true },
    } as any);

    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalled();
    expect(result).toEqual({ wouldRedact: 3 });
  });

  it("logs the dry-run count", async () => {
    selectRows = [{ id: "order-1" }];

    await processor.process({ name: "address.redact", data: { dryRun: true } } as any);

    expect(logSpy).toHaveBeenCalledWith("[dry run] would redact the street on 1 order(s)");
  });
});
