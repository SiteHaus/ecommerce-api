import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { LabelPurchaseService } from "./label-purchase.service";

/**
 * Two-step EasyPost label purchase: `getLabelRates` quotes every carrier
 * option for an order (no purchase), `buyLabel` buys the one the merchant
 * picked.
 *
 * Deliberately NOT `shipping.getRates` — that pattern is already taken by
 * `ShippingRatesHandlerController` (checkout-time flat-rate shipping-zone
 * quoting, a different feature entirely: what the *customer* is charged for
 * shipping at checkout, not what a real carrier charges the *merchant* to
 * print a label). Registering a second `@MessagePattern("shipping.getRates")`
 * in the same microservice would collide with that handler — whichever one
 * NestJS wires up last would silently shadow the other. `shipping.getLabelRates`
 * avoids the collision while keeping the `shipping.*` namespace.
 *
 * This handler also doesn't call `payments.postage.getBillingSetup` or
 * `easypost.provisionChildAccount` — those first-label-ever onboarding calls
 * (card setup + EasyPost child account creation) are a gateway-route concern
 * (Task 10), invoked once before `getRates` is ever reached. By the time a
 * request lands here, the store is assumed to already be billing-ready.
 */
@Controller()
export class LabelPurchaseHandler {
  constructor(private readonly labelPurchase: LabelPurchaseService) {}

  @MessagePattern("shipping.getLabelRates")
  getRates(@Payload() data: { orderId: string }) {
    return this.labelPurchase.getRates(data.orderId);
  }

  @MessagePattern("shipping.buyLabel")
  buyLabel(@Payload() data: { orderId: string; shipmentId: string; rateId: string }) {
    return this.labelPurchase.buyLabel(data);
  }

  @MessagePattern("shipping.ensureEasypostAccount")
  ensureEasypostAccount(@Payload() data: { storeId: string }) {
    return this.labelPurchase.ensureEasypostAccount(data.storeId);
  }
}
