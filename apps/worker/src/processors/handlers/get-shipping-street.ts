import { firstValueFrom } from "rxjs";
import type { HandlerContext } from "./handler.context";

export type ShippingStreet = { line1: string | null; line2: string | null };

/**
 * Where the street lives depends on when the order was placed.
 *
 * New orders: on the Stripe PaymentIntent (our DB never saw it).
 * Legacy orders: still in `orders.shipping_line1/line2`, until the redaction cron clears them.
 *
 * Ask Stripe first, fall back to the columns. If payments is unreachable we STILL fall back
 * rather than throwing — an order confirmation that goes out with a blank street is bad, but
 * a confirmation that never goes out at all is worse.
 */
export async function getShippingStreet(
  ctx: HandlerContext,
  order: { id: string; shippingLine1: string | null; shippingLine2: string | null },
): Promise<ShippingStreet> {
  try {
    const fromStripe = await firstValueFrom(
      ctx.payments.send<ShippingStreet>("stripe.shipping.get", { orderId: order.id }),
    );
    if (fromStripe?.line1) return fromStripe;
  } catch (err) {
    ctx.logger.warn(`Shipping street lookup failed for order ${order.id}: ${errorMessage(err)}`);
  }
  return { line1: order.shippingLine1, line2: order.shippingLine2 };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
