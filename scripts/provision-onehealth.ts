/**
 * Production provisioning script for OneHealth Clinics.
 *
 * Creates (or updates) the OneHealth store and seeds all supplement products.
 * Safe to re-run — store uses ON CONFLICT DO UPDATE, products use DO NOTHING.
 *
 * Required env vars:
 *   DATABASE_URL             — postgres connection string
 *   PROVISION_DOMAIN         — storefront domain (e.g. onehealthclinics.com)
 *   PROVISION_STRIPE_ACCOUNT — Stripe Connect account ID (e.g. acct_xxx)
 *
 * Usage:
 *   DATABASE_URL=... PROVISION_DOMAIN=onehealthclinics.com PROVISION_STRIPE_ACCOUNT=acct_xxx \
 *     node --experimental-strip-types scripts/provision-onehealth.ts
 */

import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const DOMAIN = process.env.PROVISION_DOMAIN;
const STRIPE_ACCOUNT = process.env.PROVISION_STRIPE_ACCOUNT ?? null;

if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is required");
  process.exit(1);
}
if (!DOMAIN) {
  console.error("❌  PROVISION_DOMAIN is required (e.g. onehealthclinics.com)");
  process.exit(1);
}

if (!STRIPE_ACCOUNT) {
  console.warn(
    "⚠️   PROVISION_STRIPE_ACCOUNT not set — store will be created without payment capability.",
  );
  console.warn("     Run provision again with --stripe-account once Stripe Connect is set up.\n");
}

// Fixed IDs — stable across environments
const STORE_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_ID = "00000000-cafe-4bab-8000-000000000001"; // onehealth IAM client

const PRODUCTS = [
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
        stock: 45,
      },
      {
        id: "00000000-0000-4002-8000-000000000002",
        name: "120 Capsules",
        sku: "B-ESS-120",
        priceCents: 4400,
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
        stock: 38,
      },
      {
        id: "00000000-0000-4002-8000-000000000004",
        name: "120 Capsules",
        sku: "BONE-120",
        priceCents: 5500,
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
        stock: 50,
      },
      {
        id: "00000000-0000-4002-8000-000000000006",
        name: "90 Capsules",
        sku: "DIG-ENZ-90",
        priceCents: 3000,
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
        stock: 55,
      },
      {
        id: "00000000-0000-4002-8000-000000000009",
        name: "120 Capsules",
        sku: "ESS-MAG-120",
        priceCents: 3600,
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
        stock: 60,
      },
      {
        id: "00000000-0000-4002-8000-00000000000b",
        name: "120 Tablets",
        sku: "MELT-120",
        priceCents: 2800,
        stock: 30,
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
        stock: 65,
      },
      {
        id: "00000000-0000-4002-8000-000000000010",
        name: "120 Softgels",
        sku: "VIT-D3-120",
        priceCents: 4000,
        stock: 40,
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
        stock: 18,
      },
      {
        id: "00000000-0000-4002-8000-000000000012",
        name: "60 Packets",
        sku: "VIV-ESS-60",
        priceCents: 4500,
        stock: 12,
      },
    ],
  },
];

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

try {
  console.log(`\n🌱  Provisioning OneHealth store on ${DOMAIN}...\n`);

  const stripeReady = STRIPE_ACCOUNT !== null;
  await client.query(
    `
    INSERT INTO stores (
      id, client_id, name, slug, domain,
      stripe_account_id, stripe_charges_enabled,
      stripe_payouts_enabled, stripe_details_submitted,
      currency, reservation_ttl_minutes
    ) VALUES (
      $1, $2, 'OneHealth Clinics', 'onehealth', $3,
      $4, $5, $5, $5,
      'usd', 15
    )
    ON CONFLICT (id) DO UPDATE SET
      domain                   = EXCLUDED.domain,
      stripe_account_id        = EXCLUDED.stripe_account_id,
      stripe_charges_enabled   = EXCLUDED.stripe_charges_enabled,
      stripe_payouts_enabled   = EXCLUDED.stripe_payouts_enabled,
      stripe_details_submitted = EXCLUDED.stripe_details_submitted
    `,
    [STORE_ID, CLIENT_ID, DOMAIN, STRIPE_ACCOUNT, stripeReady],
  );
  console.log(`✅  Store:    OneHealth Clinics (domain: ${DOMAIN})`);

  for (const product of PRODUCTS) {
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
        VALUES ($1, $2, $3, $4, $5, $6, NULL, true)
        ON CONFLICT (id) DO NOTHING
        `,
        [variant.id, product.id, STORE_ID, variant.name, variant.sku, variant.priceCents],
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
    console.log(`✅  Product:  ${product.name}`);
  }

  console.log(`\n🎉  OneHealth provisioned successfully.\n`);
} finally {
  await client.end();
}
