import { of } from "rxjs";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { OrderDelivered } from "@sitehaus-ecom/email-templates";
import { handleOrderDelivered } from "./order-delivered.handler";
import type { HandlerContext } from "./handler.context";

jest.mock("@react-email/render", () => ({
  render: jest.fn().mockResolvedValue("<html></html>"),
}));

jest.mock("@sitehaus-ecom/email-templates", () => ({
  OrderDelivered: jest.fn().mockReturnValue("order-delivered-element"),
}));

describe("handleOrderDelivered", () => {
  let dbFindFirst: jest.Mock;
  let storesFindFirst: jest.Mock;
  let emailSend: jest.Mock;
  let paymentsSend: jest.Mock;
  let ctx: HandlerContext;
  let job: Job;

  const baseOrder = {
    id: "order-1",
    storeId: "store-1",
    email: "customer@example.com",
    status: "delivered",
    shippingName: "Ada Lovelace",
    shippingLine1: "10 Analytical Engine Way",
    shippingLine2: null,
    shippingCity: "London",
    shippingState: null,
    shippingZip: "SW1A 1AA",
    shippingCountry: "GB",
    shippingCents: 500,
    subtotalCents: 2000,
    taxCents: 100,
    totalCents: 2600,
    currency: "usd",
    trackingNumber: "1Z999AA10123456784",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    deliveredAt: new Date("2026-01-05T00:00:00Z"),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    dbFindFirst = jest.fn().mockResolvedValue(baseOrder);
    storesFindFirst = jest.fn().mockResolvedValue({
      name: "Test Store",
      notificationEmail: null,
      notificationPreferences: null,
    });
    emailSend = jest.fn().mockResolvedValue(undefined);
    paymentsSend = jest.fn().mockReturnValue(of({ line1: null, line2: null }));

    ctx = {
      db: {
        query: {
          ordersTable: { findFirst: dbFindFirst },
          storesTable: { findFirst: storesFindFirst },
        },
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
        insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
      } as unknown as HandlerContext["db"],
      email: { send: emailSend } as unknown as HandlerContext["email"],
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      } as unknown as Logger,
      payments: { send: paymentsSend } as unknown as HandlerContext["payments"],
    };

    job = { data: { orderId: "order-1", storeId: "store-1" } } as unknown as Job;
  });

  it("renders the street fetched from Stripe, not the (now empty) column", async () => {
    dbFindFirst.mockResolvedValue({
      ...baseOrder,
      shippingLine1: null, // new order — our DB has no street
      shippingLine2: null,
    });
    paymentsSend.mockReturnValue(of({ line1: "12 Baker St", line2: "Flat 4" }));

    await handleOrderDelivered(job, ctx);

    const props = (OrderDelivered as jest.Mock).mock.calls[0][0];
    expect(props.shippingLine1).toBe("12 Baker St");
    expect(props.shippingLine2).toBe("Flat 4");
  });
});
