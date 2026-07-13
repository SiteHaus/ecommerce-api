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
  // Duplicate value-keys should never reach us (the caller snapshots only ACTIVE
  // variants, and a retired one has its option links stripped) — but if one ever
  // does, collapsing it into a Map would silently drop the loser and strand a dead
  // row that nothing ever cleans up. So: FIRST wins (deterministic, given the
  // caller orders its snapshot), and every loser is routed to toDelete.
  const existingByKey = new Map<string, string>();
  const duplicateIds: string[] = [];
  for (const e of args.existing) {
    if (existingByKey.has(e.valueKey)) {
      duplicateIds.push(e.id);
      continue;
    }
    existingByKey.set(e.valueKey, e.id);
  }

  const wantedKeys = new Set(args.rows.map((r) => keyOf(r.values)));
  const toCreate: DesiredRow[] = [];
  const toUpdate: { id: string; row: DesiredRow }[] = [];
  for (const row of args.rows) {
    const id = existingByKey.get(keyOf(row.values));
    if (id) toUpdate.push({ id, row });
    else toCreate.push(row);
  }

  const unwantedIds = args.existing
    .filter((e) => !wantedKeys.has(e.valueKey))
    .map((e) => e.id)
    .filter((id) => !duplicateIds.includes(id));
  const toDelete = [...unwantedIds, ...duplicateIds];
  return { toCreate, toUpdate, toDelete };
}
