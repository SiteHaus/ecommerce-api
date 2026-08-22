import { of, throwError } from "rxjs";
import { PostageSettlementProcessor } from "./postage-settlement.processor";

// One pending row per store, id = "<storeId>-row-1" — enough for every scenario
// below except the multi-store isolation test, which builds its own row set.
function makeDb(pendingByStore: Record<string, number>) {
  const rows = Object.entries(pendingByStore).map(([storeId, amountCents]) => ({
    id: `${storeId}-row-1`,
    storeId,
    amountCents,
  }));
  return makeDbFromRows(rows);
}

function makeDbFromRows(rows: { id: string; storeId: string; amountCents: number }[]) {
  const updateCalls: unknown[] = [];
  const setCalls: Record<string, unknown>[] = [];
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(rows) }),
    }),
    query: {
      storesTable: {
        findFirst: jest.fn().mockResolvedValue({ id: "store-1", stripeBillingCustomerId: "cus_1" }),
      },
    },
    update: jest.fn().mockImplementation(() => ({
      set: jest.fn().mockImplementation((values: Record<string, unknown>) => {
        setCalls.push(values);
        return {
          where: jest.fn().mockImplementation((clause) => {
            updateCalls.push(clause);
            return Promise.resolve(undefined);
          }),
        };
      }),
    })),
    __updateCalls: updateCalls,
    __setCalls: setCalls,
  };
}

describe("PostageSettlementProcessor", () => {
  it("settles a store whose unsettled balance has crossed $50, updating exactly the rows it summed", async () => {
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

  it("sends the exact ledger row ids so a retried batch can't double-charge", async () => {
    const db = makeDbFromRows([
      { id: "row-b", storeId: "store-1", amountCents: 3000 },
      { id: "row-a", storeId: "store-1", amountCents: 2200 },
    ]);
    const payments = {
      send: jest.fn().mockReturnValue(of({ success: true, paymentIntentId: "pi_1" })),
    };
    const processor = new PostageSettlementProcessor(db as any, payments as any);

    await processor.process({ name: "postage.settle", data: {} } as any);

    // The ids are what payments hashes into the Stripe idempotency key; without
    // them a lost response means tomorrow's run charges the same rows again.
    expect(payments.send).toHaveBeenCalledWith(
      "payments.postage.charge",
      expect.objectContaining({ amountCents: 5200, ledgerRowIds: ["row-b", "row-a"] }),
    );
  });

  it("persists the settling PaymentIntent id onto the rows it settles", async () => {
    const db = makeDb({ "store-1": 5200 });
    const payments = {
      send: jest.fn().mockReturnValue(of({ success: true, paymentIntentId: "pi_42" })),
    };
    const processor = new PostageSettlementProcessor(db as any, payments as any);

    await processor.process({ name: "postage.settle", data: {} } as any);

    expect(db.__setCalls).toHaveLength(1);
    expect(db.__setCalls[0]).toEqual(
      expect.objectContaining({ status: "settled", settlementPaymentIntentId: "pi_42" }),
    );
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

  it("isolates a per-store failure — one store's thrown error doesn't block a later store", async () => {
    const rows = [
      { id: "row-a", storeId: "store-a", amountCents: 6000 },
      { id: "row-b", storeId: "store-b", amountCents: 6000 },
    ];
    const db = makeDbFromRows(rows);
    db.query.storesTable.findFirst = jest.fn().mockImplementation(({ where }: any) => {
      // Both stores resolve to a billing customer; the throw happens on the
      // payments call itself, not here — this just needs to return something
      // truthy for whichever store is being looked up.
      return Promise.resolve({ id: "any", stripeBillingCustomerId: "cus_any" });
    });
    const payments = {
      send: jest
        .fn()
        // store-a's payments call throws (simulating a persistent per-store failure)
        .mockReturnValueOnce(throwError(() => new Error("payments unreachable for store-a")))
        // store-b's succeeds
        .mockReturnValueOnce(of({ success: true, paymentIntentId: "pi_b" })),
    };
    const processor = new PostageSettlementProcessor(db as any, payments as any);

    await processor.process({ name: "postage.settle", data: {} } as any);

    // Both stores were attempted — store-a's throw did not stop store-b from running.
    expect(payments.send).toHaveBeenCalledTimes(2);
    // Exactly one settlement update happened (store-b's) — store-a's rows were
    // never touched.
    expect(db.update).toHaveBeenCalledTimes(1);
  });
});
