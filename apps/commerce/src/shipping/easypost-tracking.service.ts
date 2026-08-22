import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, ordersTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";

export interface EasypostTrackingEvent {
  shipmentId: string | null;
  trackingCode: string | null;
  status: string;
  rawEvent: unknown;
}

@Injectable()
export class EasypostTrackingService {
  private readonly logger = new Logger(EasypostTrackingService.name);

  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  /**
   * Resolves the order this tracking event belongs to and logs it. Full
   * status-transition logic (delivered/returned/exception handling) is out of
   * scope here — tracked separately as SIT-278. This only proves the webhook
   * lands in the right place and can find the order the label-purchase flow
   * created it for. Handled synchronously, same as the existing Stripe
   * webhook — no queue/worker hop.
   */
  async handle(
    event: EasypostTrackingEvent,
  ): Promise<{ orderId: string | null; handled: boolean }> {
    if (!event.shipmentId) {
      this.logger.warn(`EasyPost tracking event with no shipment id: ${JSON.stringify(event)}`);
      return { orderId: null, handled: false };
    }

    const order = await this.db.query.ordersTable.findFirst({
      where: eq(ordersTable.easypostShipmentId, event.shipmentId),
    });

    if (!order) {
      this.logger.warn(
        `EasyPost tracking event for unknown shipment ${event.shipmentId} — dropped`,
      );
      return { orderId: null, handled: false };
    }

    this.logger.log(
      `Tracking update for order ${order.id}: ${event.status} (${event.trackingCode})`,
    );
    return { orderId: order.id, handled: true };
  }
}
