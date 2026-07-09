/**
 * Production provisioning script for CAMO the band.
 *
 * Creates the CAMO store record. Products are managed through the commerce admin UI.
 * Safe to re-run — store uses ON CONFLICT DO UPDATE.
 *
 * Required env vars:
 *   DATABASE_URL          — postgres connection string
 *   PROVISION_DOMAIN      — storefront domain (e.g. camotheband.com)
 *   PROVISION_CLIENT_ID   — IAM client UUID resolved by the CLI
 *
 * Optional:
 *   PROVISION_STRIPE_ACCOUNT — Stripe Connect account ID (can be added later)
 */

import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const DOMAIN = process.env.PROVISION_DOMAIN;
const CLIENT_ID = process.env.PROVISION_CLIENT_ID;
const STRIPE_ACCOUNT = process.env.PROVISION_STRIPE_ACCOUNT ?? null;

if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is required");
  process.exit(1);
}
if (!DOMAIN) {
  console.error("❌  PROVISION_DOMAIN is required (e.g. camotheband.com)");
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error("❌  PROVISION_CLIENT_ID is required — find it with:");
  console.error(
    "     sitehaus db query --server sitehaus-prod \"SELECT id, key FROM clients WHERE key = 'camo'\"",
  );
  process.exit(1);
}

if (!STRIPE_ACCOUNT) {
  console.warn(
    "⚠️   PROVISION_STRIPE_ACCOUNT not set — store will be created without payment capability.",
  );
  console.warn("     Run provision again with --stripe-account once Stripe Connect is set up.\n");
}

const STORE_ID = "00000000-0000-4000-8000-000000000002";

const db = new Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  console.log(`\n🌱  Provisioning CAMO store on ${DOMAIN}...\n`);

  const stripeReady = STRIPE_ACCOUNT !== null;
  await db.query(
    `
    INSERT INTO stores (
      id, client_id, name, slug, domain,
      stripe_account_id, stripe_charges_enabled,
      stripe_payouts_enabled, stripe_details_submitted,
      currency, reservation_ttl_minutes
    ) VALUES (
      $1, $2, 'CAMO', 'camo', $3,
      $4, $5, $5, $5,
      'usd', 15
    )
    ON CONFLICT (id) DO UPDATE SET
      client_id                = EXCLUDED.client_id,
      domain                   = EXCLUDED.domain,
      stripe_account_id        = EXCLUDED.stripe_account_id,
      stripe_charges_enabled   = EXCLUDED.stripe_charges_enabled,
      stripe_payouts_enabled   = EXCLUDED.stripe_payouts_enabled,
      stripe_details_submitted = EXCLUDED.stripe_details_submitted
    `,
    [STORE_ID, CLIENT_ID, DOMAIN, STRIPE_ACCOUNT, stripeReady],
  );
  console.log(`✅  Store:    CAMO (domain: ${DOMAIN})`);

  console.log(`\n🎉  CAMO provisioned successfully.`);
  console.log(`     Add products via the commerce admin at https://commerce.sitehaus.dev/camo\n`);
} finally {
  await db.end();
}
