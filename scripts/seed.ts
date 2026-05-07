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
import { randomUUID } from "crypto";

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

// Second test store (Grace Jeanne) — fixed UUIDs for multi-store testing
const GJ_STORE_ID = "00000000-0000-4000-8000-000000000002";
const GJ_CLIENT_ID = "00000000-cafe-4bab-8000-000000000002";

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
  await client.query(`DELETE FROM stores WHERE domain = 'localhost' OR domain = 'gj.localhost'`);
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

  // Second store — Grace Jeanne (multi-store test)
  await client.query(
    `
    INSERT INTO stores (id, client_id, name, slug, domain,
      stripe_account_id, stripe_charges_enabled,
      stripe_payouts_enabled, stripe_details_submitted,
      currency, reservation_ttl_minutes)
    VALUES ($1, $2, 'Grace Jeanne Dev', 'gracejeanne-dev', 'gj.localhost',
      NULL, false, false, false, 'usd', 15)
    ON CONFLICT (id) DO NOTHING
  `,
    [GJ_STORE_ID, GJ_CLIENT_ID],
  );
  console.log("✅  Store:    gracejeanne-dev (domain: gj.localhost)");

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

    // Options — "Count" option with one value per variant name
    const countOptionId = randomUUID();
    await client.query(
      `INSERT INTO product_options (id, product_id, name, sort_order)
       VALUES ($1, $2, 'Count', 0)
       ON CONFLICT DO NOTHING`,
      [countOptionId, product.id],
    );

    for (let i = 0; i < product.variants.length; i++) {
      const variant = product.variants[i];
      const valueId = randomUUID();
      await client.query(
        `INSERT INTO product_option_values (id, option_id, value, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [valueId, countOptionId, variant.name, i],
      );
      await client.query(
        `INSERT INTO variant_option_values (variant_id, option_value_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [variant.id, valueId],
      );
    }

    const stockSummary = product.variants.map((v) => `${v.name} (${v.stock} in stock)`).join(", ");
    console.log(`✅  Product:  ${product.name} — ${stockSummary}`);
  }

  // ── orders + analytics ────────────────────────────────────────────────────────

  const { faker } = await import("@faker-js/faker");
  faker.seed(42); // deterministic

  const NOW_MS = new Date("2026-05-02T18:00:00.000Z").getTime();
  const DAY_MS = 86_400_000;

  // Biased variant pool — popular products appear multiple times so top-products chart is interesting
  const VARIANT_POOL = [
    // Vitamin D3 60 (most popular)
    {
      id: products[9].variants[0].id,
      productId: products[9].id,
      productName: products[9].name,
      variantName: products[9].variants[0].name,
      sku: products[9].variants[0].sku,
      priceCents: products[9].variants[0].priceCents,
    },
    {
      id: products[9].variants[0].id,
      productId: products[9].id,
      productName: products[9].name,
      variantName: products[9].variants[0].name,
      sku: products[9].variants[0].sku,
      priceCents: products[9].variants[0].priceCents,
    },
    {
      id: products[9].variants[0].id,
      productId: products[9].id,
      productName: products[9].name,
      variantName: products[9].variants[0].name,
      sku: products[9].variants[0].sku,
      priceCents: products[9].variants[0].priceCents,
    },
    // Essential Mag 120 (2nd)
    {
      id: products[4].variants[1].id,
      productId: products[4].id,
      productName: products[4].name,
      variantName: products[4].variants[1].name,
      sku: products[4].variants[1].sku,
      priceCents: products[4].variants[1].priceCents,
    },
    {
      id: products[4].variants[1].id,
      productId: products[4].id,
      productName: products[4].name,
      variantName: products[4].variants[1].name,
      sku: products[4].variants[1].sku,
      priceCents: products[4].variants[1].priceCents,
    },
    // B Essentials 60 (3rd)
    {
      id: products[0].variants[0].id,
      productId: products[0].id,
      productName: products[0].name,
      variantName: products[0].variants[0].name,
      sku: products[0].variants[0].sku,
      priceCents: products[0].variants[0].priceCents,
    },
    {
      id: products[0].variants[0].id,
      productId: products[0].id,
      productName: products[0].name,
      variantName: products[0].variants[0].name,
      sku: products[0].variants[0].sku,
      priceCents: products[0].variants[0].priceCents,
    },
    // Vivere Essential 60 (4th)
    {
      id: products[10].variants[1].id,
      productId: products[10].id,
      productName: products[10].name,
      variantName: products[10].variants[1].name,
      sku: products[10].variants[1].sku,
      priceCents: products[10].variants[1].priceCents,
    },
    {
      id: products[10].variants[1].id,
      productId: products[10].id,
      productName: products[10].name,
      variantName: products[10].variants[1].name,
      sku: products[10].variants[1].sku,
      priceCents: products[10].variants[1].priceCents,
    },
    // Bone Support 60
    {
      id: products[1].variants[0].id,
      productId: products[1].id,
      productName: products[1].name,
      variantName: products[1].variants[0].name,
      sku: products[1].variants[0].sku,
      priceCents: products[1].variants[0].priceCents,
    },
    // Digestive Enzymes 60
    {
      id: products[2].variants[0].id,
      productId: products[2].id,
      productName: products[2].name,
      variantName: products[2].variants[0].name,
      sku: products[2].variants[0].sku,
      priceCents: products[2].variants[0].priceCents,
    },
    // Melatonin 60
    {
      id: products[5].variants[0].id,
      productId: products[5].id,
      productName: products[5].name,
      variantName: products[5].variants[0].name,
      sku: products[5].variants[0].sku,
      priceCents: products[5].variants[0].priceCents,
    },
    // Micro DHEA-25
    {
      id: products[6].variants[0].id,
      productId: products[6].id,
      productName: products[6].name,
      variantName: products[6].variants[0].name,
      sku: products[6].variants[0].sku,
      priceCents: products[6].variants[0].priceCents,
    },
    // Essential Mag 60
    {
      id: products[4].variants[0].id,
      productId: products[4].id,
      productName: products[4].name,
      variantName: products[4].variants[0].name,
      sku: products[4].variants[0].sku,
      priceCents: products[4].variants[0].priceCents,
    },
    // B12 Liquid
    {
      id: products[8].variants[0].id,
      productId: products[8].id,
      productName: products[8].name,
      variantName: products[8].variants[0].name,
      sku: products[8].variants[0].sku,
      priceCents: products[8].variants[0].priceCents,
    },
  ];

  const ORDER_COUNT = 95;
  let orderCount = 0;
  let itemCount = 0;

  for (let i = 0; i < ORDER_COUNT; i++) {
    // Weight distribution toward recent days
    const t = i / ORDER_COUNT;
    const daysAgo = Math.round((1 - Math.pow(t, 0.7)) * 89);
    const orderedAt = new Date(NOW_MS - daysAgo * DAY_MS);

    const status = daysAgo > 21 ? "delivered" : daysAgo > 7 ? "shipped" : "confirmed";

    // Build items — avoid duplicate variants per order
    const numItems = [1, 1, 2, 1, 2, 3, 1, 2][i % 8];
    const usedVariantIds = new Set<string>();
    const items: Array<{
      variantId: string;
      productName: string;
      variantName: string;
      sku: string;
      quantity: number;
      unitPriceCents: number;
      totalCents: number;
    }> = [];

    for (let j = 0; j < numItems; j++) {
      let v = VARIANT_POOL[(i * 7 + j * 13) % VARIANT_POOL.length];
      for (let k = 0; usedVariantIds.has(v.id) && k < VARIANT_POOL.length; k++) {
        v = VARIANT_POOL[(i * 7 + j * 13 + k + 1) % VARIANT_POOL.length];
      }
      usedVariantIds.add(v.id);
      items.push({
        variantId: v.id,
        productName: v.productName,
        variantName: v.variantName,
        sku: v.sku,
        quantity: 1,
        unitPriceCents: v.priceCents,
        totalCents: v.priceCents,
      });
    }

    const subtotalCents = items.reduce((s, it) => s + it.totalCents, 0);
    const shippingCents = subtotalCents >= 5000 ? 0 : 599;
    const taxCents = Math.round(subtotalCents * 0.085);
    const totalCents = subtotalCents + shippingCents + taxCents;

    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const orderId = randomUUID();

    await client.query(
      `INSERT INTO orders (
        id, store_id, email, status,
        shipping_name, shipping_line1, shipping_city, shipping_state, shipping_zip, shipping_country,
        shipping_cents, subtotal_cents, tax_cents, total_cents, currency,
        confirmed_at, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'US',$10,$11,$12,$13,'usd',$14,$14,$14)`,
      [
        orderId,
        STORE_ID,
        faker.internet.email({ firstName, lastName }).toLowerCase(),
        status,
        `${firstName} ${lastName}`,
        faker.location.streetAddress(),
        faker.location.city(),
        faker.location.state({ abbreviated: true }),
        faker.location.zipCode(),
        shippingCents,
        subtotalCents,
        taxCents,
        totalCents,
        orderedAt,
      ],
    );
    orderCount++;

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (id, order_id, variant_id, product_name, variant_name, sku, quantity, unit_price_cents, total_cents)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          randomUUID(),
          orderId,
          item.variantId,
          item.productName,
          item.variantName,
          item.sku,
          item.quantity,
          item.unitPriceCents,
          item.totalCents,
        ],
      );
      itemCount++;
    }
  }
  console.log(`✅  Orders:   ${orderCount} orders, ${itemCount} line items`);

  // Analytics events — simulate a conversion funnel with realistic drop-off
  const SESSION_COUNT = 220;
  const PRODUCT_POOL = [
    { productId: products[9].id, variantId: products[9].variants[0].id }, // Vitamin D3 (most viewed)
    { productId: products[9].id, variantId: products[9].variants[0].id },
    { productId: products[4].id, variantId: products[4].variants[1].id }, // Essential Mag
    { productId: products[4].id, variantId: products[4].variants[1].id },
    { productId: products[0].id, variantId: products[0].variants[0].id }, // B Essentials
    { productId: products[0].id, variantId: products[0].variants[0].id },
    { productId: products[10].id, variantId: products[10].variants[1].id }, // Vivere Essential
    { productId: products[1].id, variantId: products[1].variants[0].id }, // Bone Support
    { productId: products[2].id, variantId: products[2].variants[0].id }, // Digestive Enzymes
    { productId: products[5].id, variantId: products[5].variants[0].id }, // Melatonin
  ];

  let eventCount = 0;
  for (let i = 0; i < SESSION_COUNT; i++) {
    const sessionId = randomUUID();
    const daysAgo = Math.floor((i / SESSION_COUNT) * 89);
    const sessionAt = new Date(NOW_MS - daysAgo * DAY_MS);
    const product = PRODUCT_POOL[i % PRODUCT_POOL.length];

    // product_viewed — 100%
    await client.query(
      `INSERT INTO analytics_events (id, store_id, session_id, event, product_id, variant_id, created_at)
       VALUES ($1,$2,$3,'product_viewed',$4,$5,$6)`,
      [randomUUID(), STORE_ID, sessionId, product.productId, product.variantId, sessionAt],
    );
    eventCount++;

    if (i % 10 >= 3) {
      // 70% add_to_cart
      await client.query(
        `INSERT INTO analytics_events (id, store_id, session_id, event, product_id, variant_id, created_at)
         VALUES ($1,$2,$3,'add_to_cart',$4,$5,$6)`,
        [
          randomUUID(),
          STORE_ID,
          sessionId,
          product.productId,
          product.variantId,
          new Date(sessionAt.getTime() + 60_000),
        ],
      );
      eventCount++;

      if (i % 10 >= 5) {
        // 50% checkout_started
        await client.query(
          `INSERT INTO analytics_events (id, store_id, session_id, event, created_at)
           VALUES ($1,$2,$3,'checkout_started',$4)`,
          [randomUUID(), STORE_ID, sessionId, new Date(sessionAt.getTime() + 180_000)],
        );
        eventCount++;

        if (i % 10 >= 7) {
          // 30% order_completed
          await client.query(
            `INSERT INTO analytics_events (id, store_id, session_id, event, created_at)
             VALUES ($1,$2,$3,'order_completed',$4)`,
            [randomUUID(), STORE_ID, sessionId, new Date(sessionAt.getTime() + 300_000)],
          );
          eventCount++;
        }
      }
    }
  }
  console.log(`✅  Analytics: ${eventCount} events (${SESSION_COUNT} sessions)`);

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
