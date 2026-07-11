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
});
