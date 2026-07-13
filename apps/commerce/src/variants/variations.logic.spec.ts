import { generateCombinations, keyOf, diffVariants } from "./variations.logic";

describe("generateCombinations", () => {
  it("returns one empty combo for no dimensions", () => {
    expect(generateCombinations([])).toEqual([[]]);
  });
  it("returns each value for one dimension", () => {
    expect(generateCombinations([{ name: "Size", values: ["S", "M"] }])).toEqual([["S"], ["M"]]);
  });
  it("returns the cartesian product for two dimensions", () => {
    const out = generateCombinations([
      { name: "Size", values: ["S", "M"] },
      { name: "Color", values: ["Red", "Blue"] },
    ]);
    expect(out).toEqual([
      ["S", "Red"],
      ["S", "Blue"],
      ["M", "Red"],
      ["M", "Blue"],
    ]);
  });
});

describe("diffVariants", () => {
  const existing = [
    { id: "v1", valueKey: keyOf(["S"]) },
    { id: "v2", valueKey: keyOf(["M"]) },
  ];
  it("creates new combos, updates matches, deletes the rest", () => {
    const rows = [
      { values: ["S"], priceCents: 100, stock: 1 }, // matches v1 -> update
      { values: ["L"], priceCents: 300, stock: 3 }, // new -> create
    ];
    const d = diffVariants({ existing, rows });
    expect(d.toUpdate.map((u) => u.id)).toEqual(["v1"]);
    expect(d.toCreate.map((c) => c.values)).toEqual([["L"]]);
    expect(d.toDelete).toEqual(["v2"]); // M no longer wanted
  });

  // Regression: the diff MUST be computed from a snapshot taken BEFORE options/values are
  // reconciled. Size(S,M) x Color(Red,Blue) with the Color dimension removed.
  describe("dimension removal, diffed from a pre-mutation snapshot", () => {
    const preMutation = [
      { id: "v1", valueKey: keyOf(["S", "Red"]) },
      { id: "v2", valueKey: keyOf(["S", "Blue"]) },
      { id: "v3", valueKey: keyOf(["M", "Red"]) },
      { id: "v4", valueKey: keyOf(["M", "Blue"]) },
    ];
    const rows = [
      { values: ["S"], priceCents: 100, stock: 1 },
      { values: ["M"], priceCents: 100, stock: 2 },
    ];

    it("deletes all four old variants and creates S and M", () => {
      const d = diffVariants({ existing: preMutation, rows });
      expect(d.toDelete.sort()).toEqual(["v1", "v2", "v3", "v4"]);
      expect(d.toCreate.map((c) => c.values)).toEqual([["S"], ["M"]]);
      expect(d.toUpdate).toEqual([]);
    });

    it("cleans up the duplicates a post-cascade snapshot would produce", () => {
      // What the old ordering produced: the Color links were already cascaded away, so
      // every key truncated to its Size value and duplicates collapsed in the Map,
      // stranding v2/v4 forever. The service no longer diffs a corrupted snapshot, but
      // the diff itself must be duplicate-safe regardless: first wins, losers get deleted.
      const corrupted = [
        { id: "v1", valueKey: keyOf(["S"]) },
        { id: "v2", valueKey: keyOf(["S"]) },
        { id: "v3", valueKey: keyOf(["M"]) },
        { id: "v4", valueKey: keyOf(["M"]) },
      ];
      const d = diffVariants({ existing: corrupted, rows });
      expect(d.toUpdate.map((u) => u.id)).toEqual(["v1", "v3"]); // first-wins
      expect(d.toDelete.sort()).toEqual(["v2", "v4"]); // losers are reaped, not stranded
      expect(d.toCreate).toEqual([]);
    });
  });

  // N1 — a retired (inactive) variant whose option links were cascaded away can end up
  // sharing a live variant's value-key. If the Map collapsed them, the dead row would be
  // invisible to toDelete (its key IS wanted) and could even win the match and be
  // reactivated by `isActive: row.isActive ?? true`. Duplicates must never be silently
  // dropped.
  describe("duplicate existing keys", () => {
    it("keeps the first, deletes the loser, and never reactivates it", () => {
      const d = diffVariants({
        existing: [
          { id: "live-S", valueKey: keyOf(["S"]) },
          { id: "retired-S-Red", valueKey: keyOf(["S"]) }, // truncated after the cascade
        ],
        rows: [{ values: ["S"], priceCents: 100, stock: 1 }],
      });
      expect(d.toUpdate).toEqual([
        { id: "live-S", row: { values: ["S"], priceCents: 100, stock: 1 } },
      ]);
      expect(d.toDelete).toEqual(["retired-S-Red"]);
      expect(d.toCreate).toEqual([]);
    });

    it("collapse-to-plain: the live plain row wins its empty key", () => {
      const d = diffVariants({
        existing: [
          { id: "plain", valueKey: keyOf([]) },
          { id: "retired", valueKey: keyOf([]) }, // lost ALL links
        ],
        rows: [{ values: [], priceCents: 500, stock: 9 }],
      });
      expect(d.toUpdate.map((u) => u.id)).toEqual(["plain"]);
      expect(d.toDelete).toEqual(["retired"]);
    });

    it("reports an unwanted duplicate exactly once in toDelete", () => {
      const d = diffVariants({
        existing: [
          { id: "a", valueKey: keyOf(["X"]) },
          { id: "b", valueKey: keyOf(["X"]) },
        ],
        rows: [{ values: ["Y"], priceCents: 1, stock: 0 }],
      });
      expect(d.toDelete.sort()).toEqual(["a", "b"]);
      expect(d.toCreate.map((c) => c.values)).toEqual([["Y"]]);
    });
  });

  // A dimension rename leaves every value-key untouched, so variants are preserved as
  // updates (the service re-links their option values, since the option rows are new).
  it("preserves variants across a dimension rename", () => {
    const d = diffVariants({
      existing,
      rows: [
        { values: ["S"], priceCents: 100, stock: 1 },
        { values: ["M"], priceCents: 200, stock: 2 },
      ],
    });
    expect(d.toUpdate.map((u) => u.id)).toEqual(["v1", "v2"]);
    expect(d.toCreate).toEqual([]);
    expect(d.toDelete).toEqual([]);
  });
});
