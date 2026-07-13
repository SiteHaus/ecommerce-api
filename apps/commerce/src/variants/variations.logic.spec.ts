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

    it("would strand orphaned variants if the snapshot were taken post-cascade", () => {
      // What the old ordering produced: the Color links were already cascaded away, so
      // every key truncated to its Size value and duplicates collapsed in the Map.
      const corrupted = [
        { id: "v1", valueKey: keyOf(["S"]) },
        { id: "v2", valueKey: keyOf(["S"]) },
        { id: "v3", valueKey: keyOf(["M"]) },
        { id: "v4", valueKey: keyOf(["M"]) },
      ];
      const d = diffVariants({ existing: corrupted, rows });
      expect(d.toDelete).toEqual([]); // nothing cleaned up — v2/v4 survive as duplicates
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
