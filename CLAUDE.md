# CLAUDE.md

This file provides guidance to Claude Code when working with the `sitehaus-commerce` repository.

## Overview

Multi-tenant ecommerce API platform built on NestJS microservices. Each store maps to a SiteHaus client (from the main `sitehaus` monorepo). Auth is handled entirely by SiteHaus IAM via token introspection — no local auth logic.

## Technology Stack

- **Monorepo**: Turborepo with pnpm workspaces
- **Package Manager**: pnpm (v10+)
- **Node.js**: v20+
- **Framework**: NestJS 11 — TCP microservices + HTTP gateway
- **Database**: PostgreSQL 17 + Drizzle ORM
- **Queue**: BullMQ + Redis 7
- **Payments**: Stripe Connect Express + Stripe Tax
- **Storage**: Cloudflare R2 (presigned uploads)
- **Email**: React Email + Resend
- **Auth**: `@sitehaus/client-sdk` — delegates to SiteHaus IAM via token introspection

## Architecture

Three processes, one PostgreSQL database:

```
  HTTP :7020      apps/gateway       — routes only, no business logic
                       │ TCP              │ TCP
              :7021    ▼                  ▼  :7022
         apps/commerce                apps/payments
         catalog, cart, orders        Stripe Connect, webhooks, refunds
         stock, inventory

  apps/worker    — BullMQ background jobs (async order processing, emails, etc.)
```

**Gateway** is the only public-facing service. It validates IAM tokens, then proxies to the internal TCP services. Never put business logic in the gateway.

## Packages

- **`packages/database`** — Drizzle ORM schema + migrations + typed `Db` client
- **`packages/contracts`** — shared NestJS message patterns between gateway ↔ microservices
- **`packages/auth`** — NestJS module wrapping `@sitehaus/client-sdk` for IAM introspection
- **`packages/validation`** — Zod schemas shared across services
- **`packages/shared`** — common utilities
- **`packages/typescript-config`** — shared tsconfig bases

## Commands

```bash
# Install
pnpm i

# Dev (runs all services)
pnpm dev

# Docker (Postgres :5433, Redis :6380, RedisInsight :5541)
docker-compose -f docker-compose.dev.yml up

# Build
pnpm build

# Test
pnpm test

# Type check
pnpm check-types

# Seed database
pnpm seed
```

## Local Dev Networking

With Caddy running (`sudo caddy run --config ../sitehaus/infra/Caddyfile.dev`):

- `https://commerce-api.localhost` → gateway (:7020)

The `commerce` and `payments` TCP services are internal only — no Caddy entry needed.

## Environment Variables

```
DATABASE_URL=postgresql://ecom:ecom@localhost:5433/ecommerce
REDIS_URL=redis://localhost:6380
IAM_URL=https://iam.localhost          # local dev; prod: https://iam.sitehaus.io
IAM_CLIENT_KEY=<from SiteHaus dashboard>
SESSION_SECRET=<32+ char string>
SEED_CLIENT_ID=<your IAM user's clientId — decode access token at jwt.io>
```

## Key Patterns

- **Auth**: All protected routes use the `@sitehaus/client-sdk` NestJS guard, which introspects tokens against the IAM service. No JWT verification happens locally.
- **Multi-tenancy**: Each store is scoped to a SiteHaus `clientId`. Store lookups always filter by `clientId` derived from the IAM token.
- **TCP messages**: Gateway ↔ microservice communication uses NestJS `MessagePattern` / `ClientProxy`. Patterns are defined in `packages/contracts`.
- **Payments**: Stripe Connect Express — platform takes no fee. Each store owner has their own Stripe account.
- **File uploads**: Presigned R2 URLs — client uploads directly to R2, never through the gateway.

## Port Assignments

| Service      | Port |
| ------------ | ---- |
| gateway      | 7020 |
| commerce     | 7021 |
| payments     | 7022 |
| PostgreSQL   | 5433 |
| Redis        | 6380 |
| RedisInsight | 5541 |
