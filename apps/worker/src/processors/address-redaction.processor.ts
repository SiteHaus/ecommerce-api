import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { and, isNotNull, lt, or, sql, ordersTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import type { Job } from "bullmq";

/**
 * Stripe's chargeback window is ~120 days. Redacting a street before it closes would strip a
 * store of its dispute defence — proving you shipped to the address the customer gave you is
 * exactly how you win one. So this is deliberately "redact once the window closes", not
 * "delete on delivery". Do not shorten this without understanding that trade.
 *
 * Only line1/line2 go. City/state/zip/name stay: they drive shipping zones, tax and
 * analytics, and are not the part that points at someone's front door.
 */
const DISPUTE_WINDOW_DAYS = 120;

@Processor("ecom-orders")
export class AddressRedactionProcessor extends WorkerHost {
  private readonly logger = new Logger(AddressRedactionProcessor.name);

  constructor(@Inject(DB_TOKEN) private readonly db: Db) {
    super();
  }

  async process(job: Job): Promise<{ redacted?: number; wouldRedact?: number }> {
    if (job.name !== "address.redact") return {};

    const dryRun = (job.data as { dryRun?: boolean })?.dryRun === true;
    const cutoff = sql`now() - interval '${sql.raw(String(DISPUTE_WINDOW_DAYS))} days'`;
    const stale = and(
      lt(ordersTable.createdAt, cutoff),
      or(isNotNull(ordersTable.shippingLine1), isNotNull(ordersTable.shippingLine2)),
    );

    if (dryRun) {
      const rows = await this.db.select({ id: ordersTable.id }).from(ordersTable).where(stale);
      this.logger.log(`[dry run] would redact the street on ${rows.length} order(s)`);
      return { wouldRedact: rows.length };
    }

    const redacted = await this.db
      .update(ordersTable)
      .set({ shippingLine1: null, shippingLine2: null })
      .where(stale)
      .returning({ id: ordersTable.id });

    if (redacted.length) {
      this.logger.log(`Redacted the street on ${redacted.length} order(s) past the dispute window`);
    }
    return { redacted: redacted.length };
  }
}
