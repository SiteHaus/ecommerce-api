import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ClientProxy } from "@nestjs/microservices";
import { Job } from "bullmq";
import { type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN, EmailService } from "@sitehaus-ecom/shared";
import type { HandlerContext } from "./handlers/handler.context";
import { handleOrderConfirmed } from "./handlers/order-confirmed.handler";
import { handleOrderShipped } from "./handlers/order-shipped.handler";
import { handleOrderDelivered } from "./handlers/order-delivered.handler";
import { handleOrderRefunded } from "./handlers/order-refunded.handler";
import { handleReturnRequested } from "./handlers/return-requested.handler";
import { handleReturnRefunded } from "./handlers/return-refunded.handler";
import { handleAbandonedCart } from "./handlers/abandoned-cart.handler";
import { handleLowStock } from "./handlers/low-stock.handler";
import { handleOrderPlaced } from "./handlers/order-placed.handler";
import { handleRefundPlaced } from "./handlers/refund-placed.handler";

@Injectable()
@Processor("ecom-notifications")
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly email: EmailService,
    @Inject("PAYMENTS_SERVICE") private readonly payments: ClientProxy,
  ) {
    super();
  }

  private get ctx(): HandlerContext {
    return { db: this.db, email: this.email, logger: this.logger, payments: this.payments };
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case "order.confirmed":
        return handleOrderConfirmed(job, this.ctx);
      case "order.placed":
        return handleOrderPlaced(job, this.ctx);
      case "order.shipped":
        return handleOrderShipped(job, this.ctx);
      case "order.delivered":
        return handleOrderDelivered(job, this.ctx);
      case "order.refunded":
        return handleOrderRefunded(job, this.ctx);
      case "refund.placed":
        return handleRefundPlaced(job, this.ctx);
      case "order.return_requested":
        return handleReturnRequested(job, this.ctx);
      case "order.return_refunded":
        return handleReturnRefunded(job, this.ctx);
      case "cart.abandoned":
        return handleAbandonedCart(job, this.ctx);
      case "inventory.low":
        return handleLowStock(job, this.ctx);
      default:
        this.logger.warn(`Unhandled notification job: ${job.name}`);
    }
  }
}
