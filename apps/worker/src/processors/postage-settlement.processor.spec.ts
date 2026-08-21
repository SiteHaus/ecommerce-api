import { of } from "rxjs";
import { PostageSettlementProcessor } from "./postage-settlement.processor";

function makeDb(pendingByStore: Record<string, number>) {
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          groupBy: jest
            .fn()
            .mockResolvedValue(
              Object.entries(pendingByStore).map(([storeId, total]) => ({ storeId, total })),
            ),
        }),
      }),
    }),
    query: {
      storesTable: {
        findFirst: jest.fn().mockResolvedValue({ id: "store-1", stripeBillingCustomerId: "cus_1" }),
      },
    },
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }),
    }),
  };
}

describe("PostageSettlementProcessor", () => {
  it("settles a store whose unsettled balance has crossed $50", async () => {
    const db = makeDb({ "store-1": 5200 });
    const payments = {
      send: jest.fn().mockReturnValue(of({ success: true, paymentIntentId: "pi_1" })),
    };
    const processor = new PostageSettlementProcessor(db as any, payments as any);

    await processor.process({ name: "postage.settle", data: {} } as any);

    expect(payments.send).toHaveBeenCalledWith(
      "payments.postage.charge",
      expect.objectContaining({ stripeCustomerId: "cus_1", amountCents: 5200 }),
    );
    expect(db.update).toHaveBeenCalled();
  });

  it("does not settle a store under $50 on a non-month-end day", async () => {
    jest.spyOn(Date.prototype, "getDate").mockReturnValue(15);
    const db = makeDb({ "store-1": 1200 });
    const payments = { send: jest.fn() };
    const processor = new PostageSettlementProcessor(db as any, payments as any);

    await processor.process({ name: "postage.settle", data: {} } as any);

    expect(payments.send).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("leaves ledger rows untouched when the charge fails", async () => {
    const db = makeDb({ "store-1": 5200 });
    const payments = {
      send: jest.fn().mockReturnValue(of({ success: false, reason: "card declined" })),
    };
    const processor = new PostageSettlementProcessor(db as any, payments as any);

    await processor.process({ name: "postage.settle", data: {} } as any);

    expect(db.update).not.toHaveBeenCalled();
  });
});
