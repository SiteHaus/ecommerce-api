/**
 * One-time backfill: converts flat variant names → structured option values.
 *
 * Parses variant names using " / " as a dimension separator.
 * Each dimension becomes a product_option; each unique value a product_option_value.
 * Variants are linked to their option values via variant_option_values.
 * Products that already have options are skipped (safe to re-run).
 *
 * Usage:
 *   STORE_SLUG=onehealth node --experimental-strip-types scripts/backfill-options.ts
 *   STORE_ID=<uuid>       node --experimental-strip-types scripts/backfill-options.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { Client } from "pg";
import { randomUUID } from "crypto";

// Names assigned to each dimension by position — extend if needed
const OPTION_NAMES_BY_POSITION = ["Size", "Color", "Flavor"];
const DIMENSION_SEPARATOR = " / ";

// ── env ───────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(import.meta.dirname, "../apps/commerce/.env");
  try {
    const raw = readFileSync(envPath, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL not set. Add it to apps/commerce/.env or export it.");
  process.exit(1);
}

const TARGET_STORE_ID = process.env.STORE_ID;
const TARGET_STORE_SLUG = process.env.STORE_SLUG;

if (!TARGET_STORE_ID && !TARGET_STORE_SLUG) {
  console.error(
    "❌  Set STORE_ID or STORE_SLUG.\n    Example: STORE_SLUG=onehealth-dev node --experimental-strip-types scripts/backfill-options.ts",
  );
  process.exit(1);
}

// ── main ──────────────────────────────────────────────────────────────────────

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

try {
  // Resolve store
  const storeRes = await client.query(
    TARGET_STORE_ID
      ? `SELECT id, name, slug FROM stores WHERE id = $1`
      : `SELECT id, name, slug FROM stores WHERE slug = $1`,
    [TARGET_STORE_ID ?? TARGET_STORE_SLUG],
  );

  if (storeRes.rows.length === 0) {
    console.error("❌  Store not found.");
    process.exit(1);
  }

  const store = storeRes.rows[0] as { id: string; name: string; slug: string };
  console.log(`\n🏪  Store: ${store.name} (${store.slug})\n`);

  const productsRes = await client.query(
    `SELECT id, name FROM products WHERE store_id = $1 AND status != 'archived' ORDER BY name`,
    [store.id],
  );

  let processed = 0,
    skipped = 0;
  const total = productsRes.rows.length;

  for (const product of productsRes.rows as { id: string; name: string }[]) {
    // Skip products that already have options (idempotency)
    const existing = await client.query(
      `SELECT 1 FROM product_options WHERE product_id = $1 LIMIT 1`,
      [product.id],
    );
    if (existing.rows.length > 0) {
      console.log(`⏭️   ${product.name} — already migrated, skipping`);
      skipped++;
      continue;
    }

    const variantsRes = await client.query(
      `SELECT id, name FROM product_variants
       WHERE product_id = $1 AND store_id = $2
       ORDER BY sort_order`,
      [product.id, store.id],
    );

    const variants = variantsRes.rows as { id: string; name: string }[];

    if (variants.length === 0) {
      console.log(`⚠️   ${product.name} — no variants, skipping`);
      skipped++;
      continue;
    }

    // Collect unique values per dimension index, preserving insertion order
    const dimensionValues = new Map<number, string[]>();
    for (const v of variants) {
      const parts = v.name.split(DIMENSION_SEPARATOR);
      for (let i = 0; i < parts.length; i++) {
        const val = parts[i].trim();
        if (!dimensionValues.has(i)) dimensionValues.set(i, []);
        if (!dimensionValues.get(i)!.includes(val)) {
          dimensionValues.get(i)!.push(val);
        }
      }
    }

    // Insert options and values, tracking IDs for the join table
    const optionIdByIndex = new Map<number, string>();
    const valueIdByKey = new Map<string, string>(); // `${idx}:${value}` → uuid

    for (const [idx, values] of dimensionValues.entries()) {
      const optionId = randomUUID();
      optionIdByIndex.set(idx, optionId);
      const optionName = OPTION_NAMES_BY_POSITION[idx] ?? `Option ${idx + 1}`;

      await client.query(
        `INSERT INTO product_options (id, product_id, name, sort_order)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [optionId, product.id, optionName, idx],
      );

      for (let s = 0; s < values.length; s++) {
        const valueId = randomUUID();
        valueIdByKey.set(`${idx}:${values[s]}`, valueId);
        await client.query(
          `INSERT INTO product_option_values (id, option_id, value, sort_order)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [valueId, optionId, values[s], s],
        );
      }
    }

    // Link each variant to its option values
    for (const v of variants) {
      const parts = v.name.split(DIMENSION_SEPARATOR);
      for (let i = 0; i < parts.length; i++) {
        const valueId = valueIdByKey.get(`${i}:${parts[i].trim()}`);
        if (!valueId) continue;
        await client.query(
          `INSERT INTO variant_option_values (variant_id, option_value_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [v.id, valueId],
        );
      }
    }

    const variantSummary = variants.map((v) => v.name).join(", ");
    console.log(
      `✅  ${product.name} — ${variants.length} variant(s), ${dimensionValues.size} option(s): ${variantSummary}`,
    );
    processed++;
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Done. ${processed}/${total} migrated, ${skipped} skipped.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  After running, verify in the admin UI that option names
  look right ("Size", "Color", "Flavor" by position).
  Rename any that need it — the picker displays whatever name you set.
`);
} finally {
  await client.end();
}
