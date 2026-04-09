# Store Resolution & Auth Flow

How requests are tied to a store, and how auth works for each caller type.

---

## Players

| Name               | What it is                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **IAM**            | Identity provider. Issues JWTs. Every OAuth client (dashboard, commerce admin, storefronts) is registered here with a unique UUID. |
| **Commerce API**   | The gateway + microservices. Every request must resolve to a `Store` before handlers run.                                          |
| **Commerce Admin** | Next.js UI at `commerce.sitehaus.dev`. SiteHaus employees use this to manage client stores.                                        |
| **Storefront**     | Client-owned Next.js site (e.g., `onehealthclinics.com`). Public-facing catalog, cart, checkout.                                   |
| **Store record**   | A row in the commerce `stores` table. Has a `slug`, optional `domain`, and a `client_id` (the IAM client UUID it belongs to).      |
| **IAM client**     | An OAuth application registered in IAM. Every client has a UUID and a human-readable `key` (e.g., `one-health`).                   |

---

## The Two Request Flows

### 1. Storefront → Commerce API (public, no auth)

```
Storefront (onehealthclinics.com)
  → sets header: x-store-slug: onehealthclinics
  → GET /v1/catalog/products

Commerce API — StoreResolutionMiddleware runs:
  1. x-store-slug header present?  → findBySlug("onehealthclinics")  ✓ done
  2. Host header matches a domain? → findByDomain("onehealthclinics.com")
  3. :slug route param present?    → findBySlug(slug)
  4. Bearer token has clientId?    → findByClientId(clientId)
  → sets req.store  OR throws 404 "Store not found"

Handler runs with req.store already populated.
```

**What ties storefront to store:** The `NEXT_PUBLIC_STORE_SLUG` env var on the storefront must match the `slug` column in the commerce `stores` table.

**Note:** Admin routes (`/v1/admin/*`) skip this middleware entirely — they use the guard below instead.

---

### 2. Commerce Admin → Commerce API (authenticated)

```
User logs into Commerce Admin via IAM OAuth
  → JWT issued with clientId = <IAM client UUID of the user's business>

Commerce Admin → GET /v1/admin/stores/accessible?clientIds=<uuid1>,<uuid2>
  (clientIds come from IAM: GET /clients/me/clients — the clients this user can manage)

Commerce API — AccessGuard validates JWT, sets req.user

getAccessible handler:
  → findByClientIds([uuid1, uuid2, ...])
  → returns stores that exist for those clients
  (no store = empty array, not an error)

Commerce Admin → GET /v1/admin/stores/me  (or routes using AdminStoreGuard)

AdminStoreGuard:
  → findByClientId(req.user.clientId)
  → sets req.store  OR throws 404
```

**What ties admin user to store:** The `client_id` column in `stores` must match the UUID of the IAM client the user belongs to.

---

## The Provision Step

Before any admin operations work, a store must be provisioned. This creates the `stores` row that links an IAM client to a commerce store.

```bash
sitehaus db provision --client-key one-health --platform-server sitehaus-staging
```

What this does internally:

1. SSHes into the **platform server** (IAM), queries: `SELECT id FROM clients WHERE key = 'one-health'`
2. Gets back UUID (e.g., `928d3d97-1b05-41cb-bdc9-b856a653ab61`)
3. SSHes into the **ecom server**, runs the provision migration using that UUID as `clientId`

After provisioning:

```
IAM clients:   id = 928d3d97-...   key = one-health
                        ↓  (matched by provision)
Commerce stores:  client_id = 928d3d97-...   slug = onehealthclinics
                                                        ↑
Storefront env:  NEXT_PUBLIC_STORE_SLUG = onehealthclinics
```

---

## Per-Client Setup Checklist

When onboarding a new client to commerce:

**On the IAM side (sitehaus repo):**

- [ ] IAM client exists with a clear key (e.g., `one-health`)
- [ ] Client users have their roles assigned

**On the Commerce API (ecom server):**

- [ ] Run `sitehaus db provision --client-key <key> --platform-server <name>`
- [ ] Verify: `sitehaus db query "SELECT id, slug, client_id FROM stores;"`

**On the storefront:**

- [ ] `NEXT_PUBLIC_STORE_SLUG` set to the store's slug (must match DB)
- [ ] `NEXT_PUBLIC_ECOM_API_URL` set to the commerce API URL

**On Vercel (storefront):**

- [ ] Same env vars above set in Vercel project settings for the deployment environment

---

## Troubleshooting: "Store not found"

| Symptom                                | Likely cause                                       | Fix                                             |
| -------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Commerce admin shows "Store not found" | Store not provisioned                              | Run `sitehaus db provision`                     |
| Commerce admin empty after login       | User's IAM clients have no stores                  | Provision a store for their client key          |
| Storefront gets 404 on catalog/cart    | `NEXT_PUBLIC_STORE_SLUG` wrong or store inactive   | Check slug matches DB; check `is_active = true` |
| Storefront gets 404 on custom domain   | `domain` column not set on store                   | Update store via admin UI or directly in DB     |
| Everything broken after deploy         | `IAM_URL` / `IAM_CLIENT_KEY` wrong on commerce API | Run `sitehaus env-check --server <ecom-server>` |

---

## Env Vars That Matter

### Commerce API (ecom server)

| Var                 | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `DATABASE_URL`      | Postgres connection                                |
| `REDIS_URL`         | Store resolution cache (60s TTL)                   |
| `IAM_URL`           | IAM base URL for token introspection               |
| `IAM_CLIENT_KEY`    | Which IAM client the commerce API authenticates as |
| `SESSION_SECRET`    | Anon session signing                               |
| `STRIPE_SECRET_KEY` | Payments (optional until Stripe is connected)      |

### Storefront (e.g., onehealthclinics)

| Var                        | Purpose                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_ECOM_API_URL` | Commerce API base URL                                                   |
| `NEXT_PUBLIC_STORE_SLUG`   | Which store this storefront belongs to — must match `stores.slug` in DB |
