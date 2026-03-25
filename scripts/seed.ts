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
const CLIENT_ID = "a43e7247-3aae-4477-ae5e-2c7a883f7e8b"; // fake SiteHaus clientId

const products = [
  {
    id: "00000000-0000-4001-8000-000000000001",
    name: "Vitamin C 1000mg",
    description: "High-potency vitamin C for immune support.",
    variants: [
      {
        id: "00000000-0000-4002-8000-000000000001",
        name: "90 Capsules",
        sku: "VIT-C-90",
        priceCents: 2499,
        compareAtCents: 2999,
        stock: 50,
      },
      {
        id: "00000000-0000-4002-8000-000000000002",
        name: "180 Capsules",
        sku: "VIT-C-180",
        priceCents: 4299,
        compareAtCents: 4999,
        stock: 30,
      },
    ],
  },
  {
    id: "00000000-0000-4001-8000-000000000002",
    name: "Magnesium Glycinate",
    description: "Highly bioavailable magnesium for sleep and muscle recovery.",
    variants: [
      {
        id: "00000000-0000-4002-8000-000000000003",
        name: "120 Capsules",
        sku: "MAG-GLY-120",
        priceCents: 3299,
        compareAtCents: null,
        stock: 25,
      },
    ],
  },
  {
    id: "00000000-0000-4001-8000-000000000003",
    name: "Omega-3 Fish Oil",
    description: "Ultra-pure EPA/DHA for cardiovascular and cognitive health.",
    variants: [
      {
        id: "00000000-0000-4002-8000-000000000004",
        name: "60 Softgels",
        sku: "OMG-3-60",
        priceCents: 2799,
        compareAtCents: 3299,
        stock: 3, // low stock on purpose
      },
      {
        id: "00000000-0000-4002-8000-000000000005",
        name: "120 Softgels",
        sku: "OMG-3-120",
        priceCents: 4999,
        compareAtCents: null,
        stock: 0, // out of stock on purpose
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
      'acct_test_replace_me', false,
      false, false,
      'cad', 15)
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

  storeId         ${STORE_ID}

  variantVitC90   ${products[0].variants[0].id}
  variantVitC180  ${products[0].variants[1].id}
  variantMag      ${products[1].variants[0].id}
  variantOmega60  ${products[2].variants[0].id}   ← low stock
  variantOmega120 ${products[2].variants[1].id}   ← out of stock

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️   For checkout to work, replace stripe_account_id
       in the store row with a real Stripe test account.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
} finally {
  await client.end();
}
