export function generateCombinations(dimensions: { name: string; values: string[] }[]): string[][] {
  return dimensions.reduce<string[][]>(
    (acc, dim) => acc.flatMap((combo) => dim.values.map((v) => [...combo, v])),
    [[]],
  );
}

export function keyOf(values: string[]): string {
  return JSON.stringify(values);
}

export type DesiredRow = {
  values: string[];
  priceCents: number;
  stock: number;
  sku?: string | null;
  isActive?: boolean;
  compareAtCents?: number | null;
};

export function diffVariants(args: {
  existing: { id: string; valueKey: string }[];
  rows: DesiredRow[];
}): {
  toCreate: DesiredRow[];
  toUpdate: { id: string; row: DesiredRow }[];
  toDelete: string[];
} {
  const existingByKey = new Map(args.existing.map((e) => [e.valueKey, e.id]));
  const wantedKeys = new Set(args.rows.map((r) => keyOf(r.values)));
  const toCreate: DesiredRow[] = [];
  const toUpdate: { id: string; row: DesiredRow }[] = [];
  for (const row of args.rows) {
    const id = existingByKey.get(keyOf(row.values));
    if (id) toUpdate.push({ id, row });
    else toCreate.push(row);
  }
  const toDelete = args.existing.filter((e) => !wantedKeys.has(e.valueKey)).map((e) => e.id);
  return { toCreate, toUpdate, toDelete };
}
