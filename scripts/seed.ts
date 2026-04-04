/**
 * Dev seeder — creates a OneHealth-flavoured test store with products,
 * variants, and inventory so you can test the full cart → checkout flow.
 *
 * Usage:
 *   node --experimental-strip-types scripts/seed.ts
 *
 * Reads DATABASE_URL from apps/commerce/.env automatically.
 * Safe to re-run — all inserts use ON CONFLICT DO NOTHING.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { Client } from "pg";

// ── load env ──────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(import.meta.dirname, "../apps/commerce/.env");
  try {
    const contents = readFileSync(envPath, "utf-8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // env file optional — fall back to process.env
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Add it to apps/commerce/.env or export it.");
  process.exit(1);
}

// ── seed data ─────────────────────────────────────────────────────────────────

const STORE_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_ID = process.env.SEED_CLIENT_ID ?? "00000000-0000-0000-0000-000000000000";
const STRIPE_ACCOUNT_ID = process.env.SEED_STRIPE_ACCOUNT_ID ?? "";

const products = [
  {
    id: "00000000-0000-4001-8000-000000000001",
    name: "B Essentials",
    description:
      "A comprehensive B-vitamin complex to support energy metabolism and nervous system health.",
    variants: [
      {
        id: "00000000-0000-4002-8000-000000000001",
        name: "60 Capsules",
        sku: "B-ESS-60",
        priceCents: 2400,
        compareAtCents: null,
        stock: 45,
      },
      {
        id: "00000000-0000-4002-8000-000000000002",
        name: "120 Capsules",
        sku: "B-ESS-120",
        priceCents: 4400,
        compareAtCents: null,
        stock: 30,
      },
    ],
  },
  {
    id: "00000000-0000-4001-8000-000000000002",
    name: "Bone Support",
    description:
      "Advanced formula with calcium, magnesium, vitamin D3, and K2 for optimal bone density.",
    variants: [
      {
        id: "00000000-0000-4002-8000-000000000003",
        name: "60 Capsules",
        sku: "BONE-60",
        priceCents: 3000,
        compareAtCents: null,
        stock: 38,
      },
      {
        id: "00000000-0000-4002-8000-000000000004",
        name: "120 Capsules",
        sku: "BONE-120",
        priceCents: 5500,
        compareAtCents: null,
        stock: 20,
      },
    ],
  },
  {
    id: "00000000-0000-4001-8000-000000000003",
    name: "Digestive Enzymes",
    description: "Full-spectrum enzyme blend to support digestion and nutrient absorption.",
    variants: [
      {
        id: "00000000-0000-4002-8000-000000000005",
        name: "60 Capsules",
        sku: "DIG-ENZ-60",
        priceCents: 2200,
        compareAtCents: null,
        stock: 50,
      },
      {
        id: "00000000-0000-4002-8000-000000000006",
        name: "90 Capsules",
        sku: "DIG-ENZ-90",
        priceCents: 3000,
        compareAtCents: null,
        stock: 25,
      },
    ],
  },
  {
    id: "00000000-0000-4001-8000-000000000004",
    name: "Easy Iron",
    description: "Gentle, non-constipating iron bisglycinate for effective iron repletion.",
    variants: [
      {
        id: "00000000-0000-4002-8000-000000000007",
        name: "60 Capsules",
        sku: "EASY-IRON-60",
        priceCents: 2200,
        compareAtCents: null,
        stock: 40,
      },
    ],
  },
  {
    id: "00000000-0000-4001-8000-000000000005",
    name: "Essential Mag",
    description:
      "Highly absorbable magnesium glycinate for relaxation, sleep, and muscle recovery.",
    variants: [
      {
        id: "00000000-0000-4002-8000-000000000008",
        name: "60 Capsules",
        sku: "ESS-MAG-60",
        priceCents: 2000,
        compareAtCents: null,
        stock: 55,
      },
      {
        id: "00000000-0000-4002-8000-000000000009",
        name: "120 Capsules",
        sku: "ESS-MAG-120",
        priceCents: 3600,
        compareAtCents: null,
        stock: 35,
      },
    ],
  },
  {
    id: "00000000-0000-4001-8000-000000000006",
    name: "Melatonin",
    description: "Low-dose melatonin to support healthy sleep onset and circadian rhythm.",
    variants: [
      {
        id: "00000000-0000-4002-8000-00000000000a",
        name: "60 Tablets",
        sku: "MELT-60",
        priceCents: 1600,
        compareAtCents: null,
        stock: 60,
      },
      {
        id: "00000000-0000-4002-8000-00000000000b",
        name: "120 Tablets",
        sku: "MELT-120",
        priceCents: 2800,
        compareAtCents: null,
        stock: 3, // low stock on purpose
      },
    ],
  },
  {
    id: "00000000-0000-4001-8000-000000000007",
    name: "Micro DHEA-25",
    description: "Micronized DHEA 25mg to support hormonal balance and adrenal health.",
    variants: [
      {
        id: "00000000-0000-4002-8000-00000000000c",
        name: "60 Capsules",
        sku: "DHEA-25-60",
        priceCents: 2500,
        compareAtCents: null,
        stock: 30,
      },
    ],
  },
  {
    id: "00000000-0000-4001-8000-000000000008",
    name: "Micro DHEA-50",
    description: "Micronized DHEA 50mg for enhanced hormonal support and vitality.",
    variants: [
      {
        id: "00000000-0000-4002-8000-00000000000d",
        name: "60 Capsules",
        sku: "DHEA-50-60",
        priceCents: 3000,
        compareAtCents: null,
        stock: 28,
      },
    ],
  },
  {
    id: "00000000-0000-4001-8000-000000000009",
    name: "Vitamin B12 Liquid",
    description: "Methylcobalamin B12 in liquid form for rapid absorption and energy support.",
    variants: [
      {
        id: "00000000-0000-4002-8000-00000000000e",
        name: "1 fl oz",
        sku: "B12-LIQ-1OZ",
        priceCents: 4000,
        compareAtCents: null,
        stock: 22,
      },
    ],
  },
  {
    id: "00000000-0000-4001-8000-00000000000a",
    name: "Vitamin D3",
    description: "High-potency vitamin D3 with K2 for immune function and calcium metabolism.",
    variants: [
      {
        id: "00000000-0000-4002-8000-00000000000f",
        name: "60 Softgels",
        sku: "VIT-D3-60",
        priceCents: 2200,
        compareAtCents: null,
        stock: 65,
      },
      {
        id: "00000000-0000-4002-8000-000000000010",
        name: "120 Softgels",
        sku: "VIT-D3-120",
        priceCents: 4000,
        compareAtCents: null,
        stock: 0, // out of stock on purpose
      },
    ],
  },
  {
    id: "00000000-0000-4001-8000-00000000000b",
    name: "Vivere Essential",
    description:
      "Daily foundational multivitamin with broad-spectrum micronutrients for whole-body wellness.",
    variants: [
      {
        id: "00000000-0000-4002-8000-000000000011",
        name: "30 Packets",
        sku: "VIV-ESS-30",
        priceCents: 2500,
        compareAtCents: null,
        stock: 18,
      },
      {
        id: "00000000-0000-4002-8000-000000000012",
        name: "60 Packets",
        sku: "VIV-ESS-60",
        priceCents: 4500,
        compareAtCents: null,
        stock: 12,
      },
    ],
  },
];

// ── main ──────────────────────────────────────────────────────────────────────

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

try {
  console.log("🌱  Seeding dev database...\n");

  // Clean up previous seed data (safe — keyed by dev-only domain/skus)
  await client.query(`DELETE FROM stores WHERE domain = 'localhost'`);
  console.log("🧹  Cleared previous seed rows\n");

  // Store
  await client.query(
    `
    INSERT INTO stores (id, client_id, name, slug, domain,
      stripe_account_id, stripe_charges_enabled,
      stripe_payouts_enabled, stripe_details_submitted,
      currency, reservation_ttl_minutes)
    VALUES ($1, $2, 'OneHealth Dev', 'onehealth-dev', 'localhost',
      ${STRIPE_ACCOUNT_ID ? `'${STRIPE_ACCOUNT_ID}'` : "NULL"}, ${STRIPE_ACCOUNT_ID ? "true" : "false"},
      ${STRIPE_ACCOUNT_ID ? "true, true," : "false, false,"}
      'usd', 15)
    ON CONFLICT (id) DO NOTHING
  `,
    [STORE_ID, CLIENT_ID],
  );
  console.log("✅  Store:    onehealth-dev (domain: localhost)");

  // Products + variants + inventory
  for (const product of products) {
    await client.query(
      `
      INSERT INTO products (id, store_id, name, description, status)
      VALUES ($1, $2, $3, $4, 'active')
      ON CONFLICT (id) DO NOTHING
    `,
      [product.id, STORE_ID, product.name, product.description],
    );

    for (const variant of product.variants) {
      await client.query(
        `
        INSERT INTO product_variants
          (id, product_id, store_id, name, sku, price_cents, compare_at_cents, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        ON CONFLICT (id) DO NOTHING
      `,
        [
          variant.id,
          product.id,
          STORE_ID,
          variant.name,
          variant.sku,
          variant.priceCents,
          variant.compareAtCents,
        ],
      );

      await client.query(
        `
        INSERT INTO inventory (variant_id, store_id, stock, reserved, allow_backorder)
        VALUES ($1, $2, $3, 0, false)
        ON CONFLICT DO NOTHING
      `,
        [variant.id, STORE_ID, variant.stock],
      );
    }

    const stockSummary = product.variants.map((v) => `${v.name} (${v.stock} in stock)`).join(", ");
    console.log(`✅  Product:  ${product.name} — ${stockSummary}`);
  }

  // ── summary ─────────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Bruno environment variables (copy into local.bru):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  storeId              ${STORE_ID}

  variantBEss60        ${products[0].variants[0].id}
  variantBEss120       ${products[0].variants[1].id}
  variantBone60        ${products[1].variants[0].id}
  variantDigEst60      ${products[2].variants[0].id}
  variantEasyIron      ${products[3].variants[0].id}
  variantMag60         ${products[4].variants[0].id}
  variantMelatonin60   ${products[5].variants[0].id}
  variantMelatonin120  ${products[5].variants[1].id}   ← low stock
  variantDHEA25        ${products[6].variants[0].id}
  variantDHEA50        ${products[7].variants[0].id}
  variantB12Liquid     ${products[8].variants[0].id}
  variantVitD3_60      ${products[9].variants[0].id}
  variantVitD3_120     ${products[9].variants[1].id}   ← out of stock
  variantVivere30      ${products[10].variants[0].id}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️   For checkout to work, replace stripe_account_id
       in the store row with a real Stripe test account.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
} finally {
  await client.end();
}
