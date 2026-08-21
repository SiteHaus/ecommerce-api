# Release Notes — `release/core-standards-v1`

Tracks what's shipping in this release branch, mapped to the Linear tickets driving it.
Branched from `main` at `e200cbc` on 2026-08-21. Part of Phase 6 — Core Standards (v1)
in the Ecommerce Platform project (target 2026-11-15).

## In this release

### SIT-295 — Real NestJS DI/module-boot test coverage

**Status:** implemented, verified against the real SIT-297 bug, pending final CI-green check.

Staging crash-looped 2026-08-21 because `InventoryHandlersModule` injected the
`ecom-notifications` BullMQ queue without ever registering it — a real DI resolution
failure that shipped alongside the low-stock alert feature and sat uncaught because
existing unit tests hand-mock the queue token, bypassing real module wiring entirely.

- Added `*.module.integration.spec.ts` boot tests for the three handler modules that
  register BullMQ queues: `InventoryHandlersModule`, `OrdersHandlersModule`,
  `ReturnsHandlerModule`. Each assembles the module through NestJS's real DI container
  (real `DbModule`, real `BullModule.forRootAsync` against a live Redis) and resolves
  the actual provider classes — not just "did `compile()` throw."
- Added a `redis:7-alpine` service to `ci.yml` (mirrors `docker-compose.dev.yml`'s
  port 6380) so these tests actually run in CI, alongside the existing Postgres
  service.
- **Verified these tests actually catch the bug class they exist for**: temporarily
  reintroduced the exact SIT-297 bug (dropped `ecom-notifications` from
  `InventoryHandlersModule`'s `registerQueue` call) and confirmed the new boot test
  fails against it, then reverted.
- Deliberately scoped narrow per the ticket (three modules, not a full `AppModule`
  boot test) — `AppModule` pulls in strict env validation for R2/Resend credentials
  unrelated to the BullMQ wiring bug class this is targeting. Worth revisiting later
  once there's a reason to want broader coverage in one shot.

## Follow-ups filed, not in this release

- SIT-301 — CORS rejection returns `500` instead of `403` (found while verifying
  SIT-263, shipped directly to `main` — not part of this branch).

## Not yet started (queued behind this release)

- SIT-267 / SIT-276 (spec'd) / SIT-277 — EasyPost fulfillment (labels, postage ledger,
  billing). Spec: `docs/superpowers/specs/2026-08-21-easypost-fulfillment-design.md`
  in the `sitehaus` repo. Real money movement — implementation plan reviewed before
  code, not auto-built.
- SIT-268 — Returns Standard (customer-facing request flow)
- SIT-269 / SIT-282 / SIT-283 — Customer Accounts
- SIT-270 / SIT-285 / SIT-286 / SIT-287 — Storefront template
