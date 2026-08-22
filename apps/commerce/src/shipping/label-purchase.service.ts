import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import {
  eq,
  orderItemsTable,
  ordersTable,
  productVariantsTable,
  storesTable,
  type Db,
} from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { EasypostService, type Rate } from "./easypost.service";
import { PostageLedgerService } from "./postage-ledger.service";
import { OriginAddressService } from "./origin-address.service";

const GRAMS_PER_OZ = 28.3495;

type ShippingStreet = { line1: string | null; line2: string | null };

export type GetRatesResult =
  | { shipmentId: string; rates: Rate[] }
  | { error: "missing_weight"; variants: { variantId: string; variantName: string }[] }
  | { error: "billing_blocked" }
  | { error: "origin_required" }
  | { error: "not_found" };

export type BuyLabelResult =
  | { orderId: string; carrier: string; service: string; trackingCode: string; labelUrl: string }
  | { error: "billing_blocked" }
  | { error: "rate_expired" }
  | { error: "not_found" };

@Injectable()
export class LabelPurchaseService {
  private readonly logger = new Logger(LabelPurchaseService.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly easypost: EasypostService,
    private readonly ledger: PostageLedgerService,
    private readonly originAddress: OriginAddressService,
    @Inject("PAYMENTS_SERVICE") private readonly payments: ClientProxy,
  ) {}

  /**
   * Step one of buying a label: creates the EasyPost shipment and returns
   * every rate it offers — every carrier/service option, not just the
   * cheapest or first one. The merchant picks from these; nothing is bought
   * yet. Never charges anything.
   *
   * `storeId` is the *calling* store, from the gateway's authenticated store
   * context — never from the request body. An order belonging to another store
   * is reported as `not_found` (never "forbidden"), matching how every order
   * lookup in orders-handler.service.ts scopes by store: a merchant must not be
   * able to probe for, ship, or read the label URL of another store's order.
   */
  async getRates(orderId: string, storeId: string): Promise<GetRatesResult> {
    const order = await this.db.query.ordersTable.findFirst({ where: eq(ordersTable.id, orderId) });
    if (!order || order.storeId !== storeId) return { error: "not_found" };

    // Weight: auto-summed from every line item's variant weight × quantity. Only
    // variants actually missing one are ever surfaced — the rest of the order's
    // weight is never re-asked. Checked before any store/address lookup so a
    // missing weight never waits on anything else.
    const lines = await this.db
      .select({
        variantId: productVariantsTable.id,
        variantName: productVariantsTable.name,
        weightGrams: productVariantsTable.weightGrams,
        quantity: orderItemsTable.quantity,
      })
      .from(orderItemsTable)
      .innerJoin(productVariantsTable, eq(orderItemsTable.variantId, productVariantsTable.id))
      .where(eq(orderItemsTable.orderId, order.id));

    const missing = lines.filter((l) => l.weightGrams == null);
    if (missing.length > 0) {
      return {
        error: "missing_weight",
        variants: missing.map((m) => ({ variantId: m.variantId, variantName: m.variantName })),
      };
    }

    // Billing budget: checked next, still before touching the store's origin
    // address or EasyPost — nothing about assembling a shipment is worth doing
    // for a store that can't pay for a label anyway.
    const available = await this.ledger.availableToSpendCents(order.storeId);
    if (available <= 0) return { error: "billing_blocked" };

    const store = await this.db.query.storesTable.findFirst({
      where: eq(storesTable.id, order.storeId),
    });
    if (!store) return { error: "not_found" };

    // A store with no ship-from address on file would otherwise hand EasyPost a
    // set of empty strings, which it rejects with an opaque error that surfaces
    // as a 500. Report it as a structured, actionable state instead — the admin
    // UI points the merchant at Settings → Shipping → Labels.
    if (!this.originAddress.hasOrigin(store)) return { error: "origin_required" };

    const totalGrams = lines.reduce((sum, l) => sum + (l.weightGrams ?? 0) * l.quantity, 0);
    const weightOz = totalGrams / GRAMS_PER_OZ;

    // Street comes from Stripe via the payments service — never our DB directly.
    // Reserved slot from the address-minimization spec; falls back to the
    // order's own columns (still populated until the redaction cron clears
    // them past the dispute window) if payments is unreachable or has nothing.
    const street = await this.getShippingStreet(order);

    return this.easypost.createShipment({
      toAddress: {
        name: order.shippingName ?? "",
        street1: street.line1 ?? "",
        street2: street.line2 ?? undefined,
        city: order.shippingCity ?? "",
        state: order.shippingState ?? "",
        zip: order.shippingZip ?? "",
        country: order.shippingCountry ?? "US",
      },
      fromAddress: {
        name: store.originName ?? "",
        street1: store.originLine1 ?? "",
        street2: store.originLine2 ?? undefined,
        city: store.originCity ?? "",
        state: store.originState ?? "",
        zip: store.originZip ?? "",
        country: store.originCountry ?? "US",
      },
      parcel: { weightOz, lengthIn: 10, widthIn: 8, heightIn: 4 },
    });
  }

  /**
   * Step two: buys the exact rate the merchant picked from getRates' list.
   * Re-checks the postage budget (cheap, closes the race between the two
   * steps) but not weights — the shipment was already built against them.
   *
   * Scoped to the calling store for the same reason getRates is: buying against
   * another store's order would burn their postage budget, mark their order
   * shipped with a bogus tracking number, and leak their customer's address via
   * the returned label URL.
   */
  async buyLabel(input: {
    orderId: string;
    storeId: string;
    shipmentId: string;
    rateId: string;
  }): Promise<BuyLabelResult> {
    const order = await this.db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, input.orderId),
    });
    if (!order || order.storeId !== input.storeId) return { error: "not_found" };

    const available = await this.ledger.availableToSpendCents(order.storeId);
    if (available <= 0) return { error: "billing_blocked" };

    // EasyPost rates go stale (typically minutes), and buying a stale one throws.
    // That is a recoverable state, not a server error: the admin UI re-quotes and
    // lets the merchant pick again. `not_found` keeps its narrower meaning (the
    // order row itself is missing / not ours), so the two stay distinguishable.
    let bought: Awaited<ReturnType<EasypostService["buyLabel"]>>;
    try {
      bought = await this.easypost.buyLabel(input.shipmentId, input.rateId);
    } catch (err) {
      this.logger.warn(
        `Label purchase failed for order ${order.id} (shipment ${input.shipmentId}, rate ${input.rateId}): ${this.errorMessage(err)}`,
      );
      return { error: "rate_expired" };
    }

    await this.ledger.recordCharge(order.storeId, order.id, input.shipmentId, bought.costCents);

    await this.db
      .update(ordersTable)
      .set({
        status: "shipped",
        trackingNumber: bought.trackingCode,
        easypostShipmentId: input.shipmentId,
        labelUrl: bought.labelUrl,
        carrier: bought.carrier,
        service: bought.service,
        shippedAt: new Date(),
      })
      .where(eq(ordersTable.id, order.id));

    return {
      orderId: order.id,
      carrier: bought.carrier,
      service: bought.service,
      trackingCode: bought.trackingCode,
      labelUrl: bought.labelUrl,
    };
  }

  /**
   * Provisions the store's EasyPost child account the first time it's ever
   * needed — never a prerequisite settings-page trip. Idempotent: a store
   * that already has one is left untouched.
   */
  async ensureEasypostAccount(storeId: string): Promise<{ ready: boolean }> {
    const store = await this.db.query.storesTable.findFirst({ where: eq(storesTable.id, storeId) });
    if (!store) return { ready: false };
    if (store.easypostChildUserId) return { ready: true };

    const child = await this.easypost.provisionChildAccount(store.name);
    await this.db
      .update(storesTable)
      .set({ easypostChildUserId: child.childUserId, easypostChildApiKey: child.apiKey })
      .where(eq(storesTable.id, storeId));
    return { ready: true };
  }

  /**
   * The street lives on the Stripe PaymentIntent, not in our database (address-
   * minimization). Same "ask payments, fall back to the DB columns" pattern the
   * worker's order-lifecycle emails already use (see
   * apps/worker/src/processors/handlers/get-shipping-street.ts) — an unreachable
   * payments service must degrade a label's from/to address, never block it.
   */
  private async getShippingStreet(order: {
    id: string;
    shippingLine1: string | null;
    shippingLine2: string | null;
  }): Promise<ShippingStreet> {
    try {
      const fromStripe = await firstValueFrom(
        this.payments.send<ShippingStreet>("stripe.shipping.get", { orderId: order.id }),
      );
      if (fromStripe?.line1) return fromStripe;
    } catch (err) {
      this.logger.warn(
        `Shipping street lookup failed for order ${order.id}: ${this.errorMessage(err)}`,
      );
    }
    return { line1: order.shippingLine1 ?? null, line2: order.shippingLine2 ?? null };
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
