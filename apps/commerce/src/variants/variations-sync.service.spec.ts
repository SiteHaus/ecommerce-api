import { NotFoundException } from "@nestjs/common";
import { syncVariationsSchema } from "@sitehaus-ecom/validation";
import { VariationsSyncService } from "./variations-sync.service";

// The pure diff/generation logic (Task 2) carries the correctness tests. Here we
// only assert the service's guard rails with a hand-rolled db mock (mirrors the
// direct-construction style used across this repo's *.service.spec.ts).
describe("VariationsSyncService", () => {
  const audit = { log: jest.fn() } as any;

  it("throws NotFound when the product does not belong to the store", async () => {
    const db: any = { query: { productsTable: { findFirst: jest.fn().mockResolvedValue(null) } } };
    const svc = new VariationsSyncService(db, audit);
    await expect(
      svc.sync({ productId: "p1", storeId: "s1", dimensions: [], rows: [] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a row whose values are not a valid combination", async () => {
    const db: any = {
      query: { productsTable: { findFirst: jest.fn().mockResolvedValue({ id: "p1", name: "X" }) } },
    };
    const svc = new VariationsSyncService(db, audit);
    await expect(
      svc.sync({
        productId: "p1",
        storeId: "s1",
        dimensions: [{ name: "Size", values: ["S"] }],
        rows: [{ values: ["XL"], priceCents: 100, stock: 1 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("syncVariationsSchema", () => {
  const base = { rows: [] };

  it("accepts distinct dimension names", () => {
    const r = syncVariationsSchema.safeParse({
      ...base,
      dimensions: [
        { name: "Size", values: ["S"] },
        { name: "Color", values: ["Red"] },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects duplicate dimension names (case-insensitive)", () => {
    // Two options with the same name both resolve to one product_option row on the next
    // sync, and one's stale-value cleanup deletes the other's values.
    const r = syncVariationsSchema.safeParse({
      ...base,
      dimensions: [
        { name: "Size", values: ["S"] },
        { name: "size", values: ["Red"] },
      ],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Each option must have a unique name.");
  });
});
