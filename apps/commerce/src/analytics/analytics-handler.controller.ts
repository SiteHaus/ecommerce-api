import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { AnalyticsHandlerService } from "./analytics-handler.service";

@Controller()
export class AnalyticsHandlerController {
  constructor(private readonly analytics: AnalyticsHandlerService) {}

  @MessagePattern("analytics.trackEvent")
  trackEvent(
    @Payload()
    data: {
      storeId: string;
      sessionId: string;
      userId?: string;
      event: "product_viewed" | "add_to_cart" | "checkout_started" | "order_completed";
      productId?: string;
      variantId?: string;
      referrer?: string;
    },
  ) {
    return this.analytics.trackEvent(data);
  }

  @MessagePattern("analytics.revenue")
  revenue(
    @Payload()
    data: {
      storeId: string;
      period: "day" | "week" | "month";
      from: string;
      to: string;
    },
  ) {
    return this.analytics.revenue(data);
  }

  @MessagePattern("analytics.topProducts")
  topProducts(
    @Payload()
    data: {
      storeId: string;
      from: string;
      to: string;
      limit: number;
    },
  ) {
    return this.analytics.topProducts(data);
  }

  @MessagePattern("analytics.funnel")
  funnel(@Payload() data: { storeId: string; from: string; to: string }) {
    return this.analytics.funnel(data);
  }

  @MessagePattern("analytics.abandonedCarts")
  abandonedCarts(@Payload() data: { storeId: string; from: string; to: string }) {
    return this.analytics.abandonedCarts(data);
  }

  @MessagePattern("analytics.abandonedCartsList")
  abandonedCartsList(
    @Payload() data: { storeId: string; from: string; to: string; limit: number; offset: number },
  ) {
    return this.analytics.abandonedCartsList(data);
  }
}
