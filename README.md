# sitehaus-commerce

[![CI](https://github.com/SiteHaus/ecommerce-api/actions/workflows/ci.yml/badge.svg)](https://github.com/SiteHaus/ecommerce-api/actions/workflows/ci.yml)
[![CD](https://github.com/SiteHaus/ecommerce-api/actions/workflows/cd.yml/badge.svg)](https://github.com/SiteHaus/ecommerce-api/actions/workflows/cd.yml)
[![Built on SiteHaus](https://img.shields.io/badge/built_on-SiteHaus-%23FF4F00?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI0ZGNEYwMCIgZD0iTTEyIDJMMiAyMmgyMEwxMiAyeiIvPjwvc3ZnPg==)](https://sitehaus.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?style=flat&logo=pnpm&logoColor=white)](https://pnpm.io/)

Multi-tenant ecommerce API platform built on NestJS. Each store maps to a [SiteHaus](https://sitehaus.io) client. Stripe Connect handles payments direct to store owners — no platform fee taken.

## Stack

- **Runtime**: Node.js 20+, TypeScript 5.8
- **Framework**: NestJS 11 (TCP microservices + HTTP gateway)
- **Database**: PostgreSQL 17 + Drizzle ORM
- **Queue**: BullMQ + Redis 7
- **Payments**: Stripe Connect Express + Stripe Tax
- **Storage**: Cloudflare R2 (presigned uploads)
- **Email**: React Email + Resend
- **Auth**: [@sitehaus/client-sdk](https://www.npmjs.com/package/@sitehaus/client-sdk) — IAM token introspection
- **Monorepo**: Turborepo + pnpm workspaces

## Architecture

Three processes, one database:

```
                  ┌─────────────────────────────┐
  HTTP :7020      │         apps/gateway          │
  ────────────►   │  NestJS HTTP. Routes only.   │
                  │  No business logic, no keys.  │
                  └────────┬──────────┬───────────┘
                           │ TCP      │ TCP
                    :7021  ▼          ▼  :7022
             ┌─────────────────┐  ┌──────────────────┐
             │  apps/commerce  │  │  apps/payments   │
             │  Catalog, cart, │  │  Stripe Connect, │
             │  orders, stock  │  │  webhooks, refund│
             └─────────────────┘  └──────────────────┘
                           │              │
                           └──────┬───────┘
                                  ▼
                         ┌─────────────────┐
                         │   apps/worker   │
                         │  BullMQ jobs.   │
                         │  No HTTP/TCP.   │
                         └─────────────────┘
```

**Gateway** is the only public-facing service. It resolves store context, validates auth via IAM introspection, and proxies to commerce and payments via NestJS TCP `ClientProxy`.

**Commerce** owns all non-payment domain logic: catalog, inventory, cart, orders, shipping.

**Payments** is the only service with Stripe keys. Handles payment intents, Stripe Connect onboarding, webhook verification, and refunds.

**Worker** runs BullMQ processors for reservation expiry, cart cleanup, and transactional emails. Queries the database directly — no TCP dependency.

## Packages

| Package                            | Description                                |
| ---------------------------------- | ------------------------------------------ |
| `@sitehaus-ecom/database`          | Drizzle schema + typed DB client           |
| `@sitehaus-ecom/validation`        | Zod schemas for all inputs and enums       |
| `@sitehaus-ecom/contracts`         | ts-rest API contracts (gateway ↔ clients)  |
| `@sitehaus-ecom/auth`              | Store resolution, IAM guards, anon session |
| `@sitehaus-ecom/shared`            | DB, Redis, R2, Email, Audit modules        |
| `@sitehaus-ecom/catalog`           | Products, variants, collections, images    |
| `@sitehaus-ecom/inventory`         | Stock levels, atomic reservations          |
| `@sitehaus-ecom/orders`            | Carts, orders, shipping zones/rates        |
| `@sitehaus-ecom/checkout`          | Stripe Connect, payment intents, webhooks  |
| `@sitehaus-ecom/typescript-config` | Shared tsconfig presets                    |

## Getting started

**Prerequisites**: Node.js 20+, pnpm 10+, Docker

```bash
# Clone and install
git clone https://github.com/sitehaus/sitehaus-commerce.git
cd sitehaus-commerce
pnpm install

# Start local infrastructure (Postgres, Redis, RedisInsight)
docker-compose -f docker-compose.dev.yml up -d

# Copy env and fill in values
cp apps/gateway/.env.example apps/gateway/.env
cp apps/commerce/.env.example apps/commerce/.env
cp apps/payments/.env.example apps/payments/.env
cp apps/worker/.env.example apps/worker/.env

# Run database migrations
cd packages/database && pnpm db:migrate

# Start all services
pnpm dev
```

## Ports

| Service      | Port | Protocol |
| ------------ | ---- | -------- |
| Gateway      | 7020 | HTTP     |
| Commerce     | 7021 | TCP      |
| Payments     | 7022 | TCP      |
| PostgreSQL   | 5432 | —        |
| Redis        | 6379 | —        |
| RedisInsight | 5540 | HTTP     |

## Contributing

Pull requests are welcome. For significant changes, open an issue first. Please read [docs/standards.md](./docs/standards.md) before contributing code.

## License

[MIT](./LICENSE)
