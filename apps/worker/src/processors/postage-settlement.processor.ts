import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Job } from "bullmq";
import { firstValueFrom } from "rxjs";
import { eq, inArray, postageLedgerTable, storesTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";

const SETTLEMENT_THRESHOLD_CENTS = 5000;

function isLastDayOfMonth(date: Date): boolean {
  const tomorrow = new Date(date);
  tomorrow.setDate(date.getDate() + 1);
  return tomorrow.getMonth() !== date.getMonth();
}

@Processor("ecom-postage")
export class PostageSettlementProcessor extends WorkerHost {
  private readonly logger = new Logger(PostageSettlementProcessor.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    @Inject("PAYMENTS_SERVICE") private readonly payments: ClientProxy,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "postage.settle") return;

    const monthEnd = isLastDayOfMonth(new Date());

    // Fetch individual pending rows (not an aggregate) and group in JS. This is
    // deliberate, not a missed optimization: settlement later updates by the exact
    // row IDs captured here, not by a blind re-match on status = "pending" — a
    // charge that lands for this store between this SELECT and that store's
    // eventual UPDATE (e.g. a label purchased mid-run) must never be swept into
    // "settled" without having been part of the amount actually charged to Stripe.
    const rows = await this.db
      .select({
        id: postageLedgerTable.id,
        storeId: postageLedgerTable.storeId,
        amountCents: postageLedgerTable.amountCents,
      })
      .from(postageLedgerTable)
      .where(eq(postageLedgerTable.status, "pending"));

    // INVARIANT — refunds and the sign of `amountCents`:
    // this loop (and PostageLedgerService.getBalance, which sums the same way)
    // adds every pending row regardless of its `type` (`charge` | `refund`). No
    // refund-writing code exists yet. When it lands, refund rows MUST be
    // inserted with a NEGATIVE `amountCents` so a plain sum stays correct here
    // and in getBalance. Nothing enforces that today — no CHECK constraint, no
    // validation — so whoever writes the first refund path owns adding it (or
    // branching on `type` at both sum sites instead). Getting this backwards
    // means a refund *increases* what the merchant is billed.
    const byStore = new Map<string, { total: number; ids: string[] }>();
    for (const row of rows) {
      const entry = byStore.get(row.storeId) ?? { total: 0, ids: [] };
      entry.total += row.amountCents;
      entry.ids.push(row.id);
      byStore.set(row.storeId, entry);
    }

    for (const [storeId, { total, ids }] of byStore) {
      if (total < SETTLEMENT_THRESHOLD_CENTS && !monthEnd) continue;

      try {
        const store = await this.db.query.storesTable.findFirst({
          where: eq(storesTable.id, storeId),
          columns: { id: true, stripeBillingCustomerId: true },
        });
        if (!store?.stripeBillingCustomerId) {
          this.logger.warn(
            `Store ${storeId} has pending postage but no billing customer — skipping`,
          );
          continue;
        }

        const result = await firstValueFrom(
          this.payments.send<{ success: boolean; paymentIntentId?: string; reason?: string }>(
            "payments.postage.charge",
            {
              stripeCustomerId: store.stripeBillingCustomerId,
              amountCents: total,
              // Makes the Stripe charge idempotent for same-run/short-window retries
              // only — not a durable cross-run guarantee. See the docblock on
              // PostageBillingService.charge() for why a response lost until the
              // *next scheduled* run (24h later) can still double-charge.
              ledgerRowIds: ids,
            },
          ),
        );

        if (result.success) {
          // Settle exactly the rows this store's `total` was computed from — never
          // a fresh status re-match, which would also sweep up anything inserted
          // since the SELECT above. The PaymentIntent id is persisted with them so
          // a settled batch is always traceable to the charge that paid for it.
          await this.db
            .update(postageLedgerTable)
            .set({
              status: "settled",
              settledAt: new Date(),
              settlementPaymentIntentId: result.paymentIntentId ?? null,
            })
            .where(inArray(postageLedgerTable.id, ids));
          this.logger.log(`Settled $${(total / 100).toFixed(2)} postage for store ${storeId}`);
        } else {
          // Never credit/settle optimistically — rows stay pending, the hard cap
          // (Task 5) is what actually blocks further label purchases for this store.
          this.logger.warn(`Postage settlement failed for store ${storeId}: ${result.reason}`);
        }
      } catch (err: unknown) {
        // A persistent per-store failure (bad Stripe customer id, a payments-service
        // bug specific to this store) must never block every later store in this
        // run — or every subsequent daily run, indefinitely, since iteration order
        // isn't guaranteed stable. Isolate each store's attempt; a thrown error
        // here still leaves that store's rows untouched (pending), same as an
        // explicit { success: false } result.
        const reason = err instanceof Error ? err.message : "unknown error";
        this.logger.warn(`Postage settlement threw for store ${storeId}: ${reason}`);
      }
    }
  }
}
