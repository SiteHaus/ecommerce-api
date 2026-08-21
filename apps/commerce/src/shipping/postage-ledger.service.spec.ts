import { PostageLedgerService } from "./postage-ledger.service";

function makeDb() {
  return {
    insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
    select: jest.fn(),
  };
}

describe("PostageLedgerService.recordCharge", () => {
  it("inserts a pending charge row with the exact amount", async () => {
    const db = makeDb();
    const service = new PostageLedgerService(db as any);

    await service.recordCharge("store-1", "order-1", "shp_123", 842);

    expect(db.insert).toHaveBeenCalled();
    const valuesCall = db.insert.mock.results[0].value.values as jest.Mock;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "store-1",
        orderId: "order-1",
        easypostShipmentId: "shp_123",
        amountCents: 842,
        type: "charge",
        status: "pending",
      }),
    );
  });
});

describe("PostageLedgerService.getBalance", () => {
  it("returns both the raw pending total and the derived available-to-spend figure", async () => {
    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ total: 2000 }]) }),
      }),
    };
    const service = new PostageLedgerService(db as any);

    const result = await service.getBalance("store-1");

    expect(result).toEqual({ availableCents: 5500, pendingCents: 2000 });
  });
});

describe("PostageLedgerService.listEntries", () => {
  it("returns the store's ledger rows", async () => {
    const rows = [{ id: "e1", amountCents: 842, type: "charge", status: "pending" }];
    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({ orderBy: jest.fn().mockResolvedValue(rows) }),
        }),
      }),
    };
    const service = new PostageLedgerService(db as any);

    const result = await service.listEntries("store-1");

    expect(result).toEqual(rows);
  });
});
