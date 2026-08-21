import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Job } from "bullmq";
import { and, eq, sql, postageLedgerTable, storesTable, type Db } from "@sitehaus-ecom/database";
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

    const balances = await this.db
      .select({
        storeId: postageLedgerTable.storeId,
        // `amountCents` is Postgres `integer`, so `sum()` returns `bigint`, which
        // node-postgres hands back as a JS string with no custom type parsers
        // configured. The `::int` cast is what makes this a real number at
        // runtime (see PostageLedgerService.getBalance for the same pattern).
        total: sql<number>`sum(${postageLedgerTable.amountCents})::int`,
      })
      .from(postageLedgerTable)
      .where(eq(postageLedgerTable.status, "pending"))
      .groupBy(postageLedgerTable.storeId);

    for (const { storeId, total } of balances) {
      if (total < SETTLEMENT_THRESHOLD_CENTS && !monthEnd) continue;

      const store = await this.db.query.storesTable.findFirst({
        where: eq(storesTable.id, storeId),
        columns: { id: true, stripeBillingCustomerId: true },
      });
      if (!store?.stripeBillingCustomerId) {
        this.logger.warn(`Store ${storeId} has pending postage but no billing customer — skipping`);
        continue;
      }

      const result = await this.payments
        .send<{
          success: boolean;
          paymentIntentId?: string;
          reason?: string;
        }>("payments.postage.charge", {
          stripeCustomerId: store.stripeBillingCustomerId,
          amountCents: total,
        })
        .toPromise();

      if (result?.success) {
        await this.db
          .update(postageLedgerTable)
          .set({ status: "settled", settledAt: new Date() })
          .where(
            and(eq(postageLedgerTable.storeId, storeId), eq(postageLedgerTable.status, "pending")),
          );
        this.logger.log(`Settled $${(total / 100).toFixed(2)} postage for store ${storeId}`);
      } else {
        // Never credit/settle optimistically — rows stay pending, the hard cap
        // (Task 5) is what actually blocks further label purchases for this store.
        this.logger.warn(`Postage settlement failed for store ${storeId}: ${result?.reason}`);
      }
    }
  }
}
