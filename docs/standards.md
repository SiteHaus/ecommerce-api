# Engineering Standards

These are the conventions this codebase is built on. If you're contributing, please read this first. If something isn't covered here, match the style of the surrounding code.

---

## Philosophy

- Controllers route. Services decide. Repos query.
- The contract is the source of truth for every HTTP route — not the controller, not a DTO class.
- Never put business logic in a controller. Never put DB queries in a service.
- Extract on the **third use**, never before. Three similar lines is better than a premature abstraction.
- Do not add error handling or validation for scenarios that cannot happen.

---

## REST Conventions

### URL structure

- Plural nouns: `/products`, `/orders`, `/collections`
- Kebab-case for multi-word resources: `/shipping-zones`, `/cart-items`
- Nested one level max: `/products/:id/images` — not `/stores/:storeId/products/:id/images/upload`
- No verbs in URLs — the HTTP method is the verb. `DELETE /products/:id`, not `POST /products/:id/delete`
- Actions that don't fit CRUD go on a sub-resource: `POST /orders/:id/refund`, `POST /orders/:id/ship`

### HTTP methods

| Method   | Meaning               | Success status |
| -------- | --------------------- | -------------- |
| `GET`    | Read, no side effects | `200`          |
| `POST`   | Create a resource     | `201`          |
| `PATCH`  | Partial update        | `200`          |
| `DELETE` | Remove a resource     | `200` or `204` |

Use `POST` for actions (`POST /orders/:id/refund`), not `PATCH` with an `action` field.

### Status codes

| Situation                             | Code  |
| ------------------------------------- | ----- |
| Successful read or update             | `200` |
| Resource created                      | `201` |
| Validation failure (malformed input)  | `400` |
| Auth missing or invalid               | `401` |
| Authenticated but not permitted       | `403` |
| Resource not found                    | `404` |
| Conflict with existing state          | `409` |
| Valid input, blocked by business rule | `422` |

`400` = structurally wrong input. `422` = valid input that can't be processed (sold out, store not configured, invalid state transition).

---

## Method Naming

Every layer — controller method, service method, TCP pattern — uses the **same verb** for the same operation.

### CRUD

| Operation      | Controller | Service   | TCP pattern       |
| -------------- | ---------- | --------- | ----------------- |
| List resources | `list`     | `list`    | `products.list`   |
| Get one        | `get`      | `getById` | `products.get`    |
| Create         | `create`   | `create`  | `products.create` |
| Partial update | `update`   | `update`  | `products.update` |
| Delete         | `remove`   | `remove`  | `products.remove` |

`get` vs `getById`: controllers use `get` (ID comes from params). Services use `getById` to be explicit at the call site.

### Actions (non-CRUD)

| Operation                   | Controller | Service   | TCP pattern         |
| --------------------------- | ---------- | --------- | ------------------- |
| Mark order shipped          | `ship`     | `ship`    | `orders.ship`       |
| Refund an order             | `refund`   | `refund`  | `payments.refund`   |
| Reserve inventory           | —          | `reserve` | `inventory.reserve` |
| Release a reservation       | —          | `release` | `inventory.release` |
| Commit reserved stock       | —          | `commit`  | `inventory.commit`  |
| Merge anonymous → user cart | —          | `merge`   | `orders.mergeCart`  |

### Words to avoid

| Avoid                        | Use instead                       |
| ---------------------------- | --------------------------------- |
| `fetch`, `retrieve`, `load`  | `list` / `getById`                |
| `add`, `insert`, `save`      | `create`                          |
| `modify`, `edit`, `set`      | `update`                          |
| `delete`, `destroy`, `drop`  | `remove`                          |
| `handleX`, `processX`, `doX` | the actual verb: `refund`, `ship` |

---

## Contracts

Every HTTP route is defined in `packages/contracts` **before** the controller is written. The contract owns the HTTP method, path, request body schema, query schema, path params, and all response shapes by status code.

```typescript
// packages/contracts/src/catalog/products.contract.ts
const c = initContract();

export const productsRouter = c.router({
  create: {
    method: "POST",
    path: "/v1/products",
    body: createProductSchema,
    responses: {
      201: z.object({ product: productItem }),
      422: apiError,
    },
  },
  list: {
    method: "GET",
    path: "/v1/products/:productId",
    pathParams: z.object({ productId: z.uuid() }),
    responses: {
      200: z.object({ product: productDetail }),
      404: apiError,
    },
  },
});

export type ProductItem = z.infer<typeof productItem>;
```

Rules:

- Contract first, implementation second — always.
- Every realistic error status gets a response entry.
- Export inferred types alongside the router.

---

## Controllers

Controllers bind to contracts using `@ts-rest/nest`. **Nothing else happens in a controller.**

```typescript
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@sitehaus-ecom/contracts";

@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @StoreOwner()
  @TsRestHandler(contract.catalog.create)
  async create(@Req() req: AuthedRequest) {
    return tsRestHandler(contract.catalog.create, async ({ body }) => {
      const result = await this.products.create(body, {
        storeId: req.store!.id,
        userId: req.user!.userId,
      });
      if ("error" in result)
        return { status: 422 as const, body: { message: result.error } };
      return { status: 201 as const, body: { product: result } };
    });
  }

  @Public()
  @TsRestHandler(contract.catalog.get)
  async get(@Req() req: AuthedRequest) {
    return tsRestHandler(contract.catalog.get, async ({ params }) => {
      const product = await this.products.getById(
        params.productId,
        req.store!.id,
      );
      if (!product)
        return { status: 404 as const, body: { message: "Product not found" } };
      return { status: 200 as const, body: { product } };
    });
  }
}
```

Rules:

- `body`, `query`, and `params` arrive **pre-validated and typed** from the contract — never type them as `unknown` or call `.parse()` manually.
- Always `as const` on status codes — ts-rest needs literal types.
- Never throw HTTP exceptions inside `tsRestHandler` — return the error status.
- Guards and decorators go on the method, not inside the handler.
- If a controller grows large, split by sub-resource — one controller per resource noun.

---

## Services

Services own business logic. They have no knowledge of HTTP, ts-rest, or TCP transport.

```typescript
// ✅
async create(data: CreateProductInput, ctx: StoreContext): Promise<Product | { error: string }> {
  const [product] = await this.db.insert(schema.productsTable).values({ ...data, storeId: ctx.storeId }).returning();
  this.audit.enqueue({ storeId: ctx.storeId, action: 'product.created', targetType: 'product', targetId: product.id });
  return serialise(product);
}

// ❌ — HTTP in a service
async create(...) {
  if (!store) throw new NotFoundException();
}
```

Return shapes:

- **Success** → typed domain object
- **Not found / access denied** → `null`
- **Invalid operation** → `{ error: string }`
- **Unexpected failure** → let it propagate (DB down, constraint violation)

### StoreContext

```typescript
type StoreContext = {
  storeId: string;
  userId?: string; // undefined for anonymous/system operations
};
```

Always built in the controller from `req.store` and `req.user`. Never constructed inside a service.

---

## Database

All queries use Drizzle ORM via the `DB` injection token.

```typescript
constructor(@Inject(DB) private readonly db: Db) {}
```

### Query style

`db.query.*` for reads with relations. `db.insert/update/delete` for writes.

### Multi-tenancy — always scope to storeId

Every query on a store-owned table **must** include a `storeId` condition. No exceptions.

```typescript
// ✅
where: and(
  eq(schema.productsTable.id, id),
  eq(schema.productsTable.storeId, storeId),
);

// ❌ — data leak across stores
where: eq(schema.productsTable.id, id);
```

### Column selection on joins

Specify only the columns you need when loading relations.

```typescript
with: { author: { columns: { id: true, email: true } } }
```

### Serialisation

Postgres returns dates as `Date` objects. Always convert to ISO strings before returning.

```typescript
function serialise(row: typeof schema.productsTable.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    goesLiveAt: row.goesLiveAt?.toISOString() ?? null,
  };
}
```

### Pagination

Cursor-based only. Never offset.

```typescript
const rows = await this.db.query.productsTable.findMany({
  where: conditions.length ? and(...conditions) : undefined,
  orderBy: [desc(schema.productsTable.createdAt)],
  limit: limit + 1,
});

const hasMore = rows.length > limit;
const items = hasMore ? rows.slice(0, limit) : rows;
return {
  items: items.map(serialise),
  nextCursor: hasMore ? items.at(-1)?.id : undefined,
};
```

---

## TCP Handlers

TCP endpoints can't use ts-rest (HTTP only). Validate with Zod directly on `@Payload()`.

```typescript
// Request-response — called with clientProxy.send()
@MessagePattern('inventory.reserve')
async reserve(@Payload() data: unknown) {
  const input = reserveInventorySchema.parse(data);
  const result = await this.inventory.reserve(input);
  if (result === 'sold_out') throw new RpcException({ status: 422, message: 'Sold out', code: 'SOLD_OUT' });
  return result;
}

// Fire-and-forget — called with clientProxy.emit()
@EventPattern('order.confirmed')
async onOrderConfirmed(@Payload() data: unknown) {
  const event = orderConfirmedEventSchema.parse(data);
  await this.notifications.sendConfirmation(event);
  // No return. Never throw — failed events are lost silently.
}
```

`RpcException` shape: `{ status: number, message: string, code: string }`. The gateway's `RpcExceptionFilter` maps `status` → HTTP code.

---

## Auth

| Decorator / Guard           | What it does                                                        |
| --------------------------- | ------------------------------------------------------------------- |
| `@Public()`                 | Skips auth. `req.user` still populated if a valid token is present. |
| `@StoreOwner()`             | Requires `req.user.clientId === req.store.clientId`.                |
| `@RequirePerms('x:y')`      | All listed permissions required.                                    |
| `@RequireAnyPerm('x', 'y')` | Any listed permission sufficient.                                   |

Guards run before the handler. Never re-check ownership inside a service.

`req.user!` and `req.store!` non-null assertions are correct on guarded routes — the middleware guarantees presence.

---

## Audit Logging

Fire-and-forget via BullMQ. Never awaited on the hot path.

```typescript
this.audit.enqueue({
  storeId: ctx.storeId,
  userId: ctx.userId,
  action: "product.created", // format: domain.past_verb
  targetType: "product",
  targetId: product.id,
  meta: { name: product.name },
});
```

The `AuditProcessor` in `apps/worker` writes to the database asynchronously. If it fails, BullMQ retries it — the user's response is never affected.

---

## TypeScript

- No `any`. Use `unknown` at TCP boundaries and external API responses; narrow with Zod.
- Types from Drizzle's `$inferSelect` / `$inferInsert` or `z.infer<typeof schema>` — never re-declare them.
- No DTO classes. Zod schemas are the single source of truth for input shapes.
- `type` over `interface` for local shapes.

---

## Comments

Comment **why**, not **what**.

```typescript
// ✅ — explains a non-obvious constraint
// storeId is denormalised on variants for query performance — always filter by it
where: and(
  eq(schema.variantsTable.id, id),
  eq(schema.variantsTable.storeId, storeId),
);

// ❌ — restates the code
// Get variant by ID
where: eq(schema.variantsTable.id, id);
```

Add a comment when:

- A guard clause looks wrong but is intentional
- A business rule isn't obvious from the variable names
- There's a workaround for a library bug or external API quirk
- Step order in a multi-step operation matters for a non-obvious reason

No JSDoc on internal service methods. JSDoc only on exported module APIs.

---

## Naming

| Thing          | Convention              | Example                                   |
| -------------- | ----------------------- | ----------------------------------------- |
| Files          | `kebab-case.ts`         | `products.service.ts`                     |
| Classes        | `PascalCase`            | `ProductsService`                         |
| Methods        | `camelCase`, imperative | `create`, `getById`, `ship`               |
| DB token       | `DB`                    | `@Inject(DB)`                             |
| Audit actions  | `domain.past_verb`      | `product.created`, `order.shipped`        |
| TCP patterns   | `domain.verb`           | `inventory.reserve`, `orders.ship`        |
| BullMQ queues  | `ecom:domain`           | `ecom:inventory`, `ecom:audit`            |
| Zod schemas    | `${verb}${Noun}Schema`  | `createProductSchema`, `productItem`      |
| Inferred types | `${Verb}${Noun}Input`   | `CreateProductInput`, `ListProductsQuery` |

---

## Module Layout

```
packages/catalog/src/
  products/
    products.controller.ts   ← @TsRestHandler bindings only
    products.service.ts      ← business logic, error signaling
    products.repo.ts         ← DB queries (extract when service > ~150 lines)
  catalog.module.ts
  index.ts                   ← export { CatalogModule }
```

### Dependency rules

```
controller  →  service
service     →  repo (if extracted) | db directly (if small)
service     →  AuditModule (enqueue only, never await)
repo        →  db only
```

Controllers never import repos. Services never import controllers. No circular imports.
