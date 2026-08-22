import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  desc,
  eq,
  sql,
  postageLedgerTable,
  type Db,
  type PostageLedgerEntry,
} from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";

const HARD_CAP_CENTS = 7500;

@Injectable()
export class PostageLedgerService {
  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  /**
   * Every label purchase calls this immediately, independent of when it gets
   * billed. Never credited/charged optimistically elsewhere — settlement
   * (Task 6) is the only thing that ever marks a row `settled`.
   */
  async recordCharge(
    storeId: string,
    orderId: string,
    easypostShipmentId: string,
    amountCents: number,
  ): Promise<void> {
    await this.db.insert(postageLedgerTable).values({
      storeId,
      orderId,
      easypostShipmentId,
      amountCents,
      type: "charge",
      status: "pending",
    });
  }

  /**
   * The raw pending total and the derived $75-hard-cap figure. This backs
   * both the Settings → Shipping → Labels balance card (Task 14) and
   * `availableToSpendCents` below, so the two never drift against each other.
   *
   * INVARIANT — refunds and the sign of `amountCents`: this sums every pending
   * row regardless of `type` (`charge` | `refund`). No refund-writing code
   * exists yet. When it lands, refund rows MUST be inserted with a NEGATIVE
   * `amountCents` so this plain sum stays correct (the settlement processor's
   * grouping loop sums identically and carries the same note). Nothing enforces
   * that today — no CHECK constraint, no validation — so whoever writes the
   * first refund path owns adding it, or branching on `type` at both sum sites
   * instead. Getting it backwards makes a refund *reduce* the merchant's
   * available balance rather than restore it.
   */
  async getBalance(storeId: string): Promise<{ availableCents: number; pendingCents: number }> {
    const [row] = await this.db
      .select({
        // `amountCents` is Postgres `integer`, so `sum()` returns `bigint`. This repo's
        // `pg` Pool has no custom type parsers, so node-postgres hands back `bigint` as
        // a JS string by default — the `::int` cast is what actually makes this a
        // number at runtime, not just at the type level. (See sibling services doing
        // the same: cart-handler.service.ts, orders-handler.service.ts, etc.)
        total: sql<number>`coalesce(sum(${postageLedgerTable.amountCents}), 0)::int`,
      })
      .from(postageLedgerTable)
      .where(
        and(eq(postageLedgerTable.storeId, storeId), eq(postageLedgerTable.status, "pending")),
      );

    const pendingCents = row?.total ?? 0;
    return { availableCents: HARD_CAP_CENTS - pendingCents, pendingCents };
  }

  /**
   * `$75 − unsettled total`. Checked before every label purchase; once this
   * hits zero or below, new labels are blocked with an explicit billing error
   * until settlement succeeds and clears the balance.
   */
  async availableToSpendCents(storeId: string): Promise<number> {
    return (await this.getBalance(storeId)).availableCents;
  }

  /** Every charge/refund for a store, newest first — the transaction log in Task 14's UI. */
  async listEntries(storeId: string): Promise<PostageLedgerEntry[]> {
    return this.db
      .select()
      .from(postageLedgerTable)
      .where(eq(postageLedgerTable.storeId, storeId))
      .orderBy(desc(postageLedgerTable.createdAt));
  }
}
