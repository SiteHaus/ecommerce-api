import { of } from "rxjs";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { OrderPlaced } from "@sitehaus-ecom/email-templates";
import { handleOrderPlaced } from "./order-placed.handler";
import type { HandlerContext } from "./handler.context";

jest.mock("@react-email/render", () => ({
  render: jest.fn().mockResolvedValue("<html></html>"),
}));

jest.mock("@sitehaus-ecom/email-templates", () => ({
  OrderPlaced: jest.fn().mockReturnValue("order-placed-element"),
}));

describe("handleOrderPlaced", () => {
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
    status: "confirmed",
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
    trackingNumber: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    dbFindFirst = jest.fn().mockResolvedValue(baseOrder);
    storesFindFirst = jest.fn().mockResolvedValue({
      name: "Test Store",
      notificationEmail: "owner@teststore.com",
      notificationPreferences: { newOrder: true },
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
      email: {
        send: emailSend,
        orderFrom: jest.fn((name: string) => `${name} <orders@notify.sitehaus.dev>`),
      } as unknown as HandlerContext["email"],
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      } as unknown as Logger,
      payments: { send: paymentsSend } as unknown as HandlerContext["payments"],
    };

    job = { data: { orderId: "order-1", storeId: "store-1" } } as unknown as Job;
  });

  it("sends to the store's notification email, not the customer's", async () => {
    await handleOrderPlaced(job, ctx);

    expect(emailSend).toHaveBeenCalledWith(expect.objectContaining({ to: "owner@teststore.com" }));
  });

  it("skips entirely when the store has no notification email on file", async () => {
    storesFindFirst.mockResolvedValue({
      name: "Test Store",
      notificationEmail: null,
      notificationPreferences: { newOrder: true },
    });

    await handleOrderPlaced(job, ctx);

    expect(emailSend).not.toHaveBeenCalled();
  });

  it("skips when the merchant has turned off new-order notifications", async () => {
    storesFindFirst.mockResolvedValue({
      name: "Test Store",
      notificationEmail: "owner@teststore.com",
      notificationPreferences: { newOrder: false },
    });

    await handleOrderPlaced(job, ctx);

    expect(emailSend).not.toHaveBeenCalled();
  });

  it("passes the customer's name through to the template — the email is about them, not to them", async () => {
    await handleOrderPlaced(job, ctx);

    const props = (OrderPlaced as jest.Mock).mock.calls[0][0];
    expect(props.name).toBe("Ada Lovelace");
  });
});
