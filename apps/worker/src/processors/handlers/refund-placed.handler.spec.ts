import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { RefundPlaced } from "@sitehaus-ecom/email-templates";
import { handleRefundPlaced } from "./refund-placed.handler";
import type { HandlerContext } from "./handler.context";

jest.mock("@react-email/render", () => ({
  render: jest.fn().mockResolvedValue("<html></html>"),
}));

jest.mock("@sitehaus-ecom/email-templates", () => ({
  RefundPlaced: jest.fn().mockReturnValue("refund-placed-element"),
}));

describe("handleRefundPlaced", () => {
  let dbFindFirst: jest.Mock;
  let storesFindFirst: jest.Mock;
  let emailSend: jest.Mock;
  let ctx: HandlerContext;
  let job: Job;

  const baseOrder = {
    id: "order-1",
    storeId: "store-1",
    email: "customer@example.com",
    status: "refunded",
    shippingName: "Ada Lovelace",
    totalCents: 2600,
    currency: "usd",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    dbFindFirst = jest.fn().mockResolvedValue(baseOrder);
    storesFindFirst = jest.fn().mockResolvedValue({
      name: "Test Store",
      slug: "test-store",
      notificationEmail: "owner@teststore.com",
      notificationPreferences: { paymentFailed: true },
    });
    emailSend = jest.fn().mockResolvedValue(undefined);

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
      payments: {} as unknown as HandlerContext["payments"],
    };

    job = { data: { orderId: "order-1", storeId: "store-1" } } as unknown as Job;
  });

  it("sends to the store's notification email, not the customer's", async () => {
    await handleRefundPlaced(job, ctx);

    expect(emailSend).toHaveBeenCalledWith(expect.objectContaining({ to: "owner@teststore.com" }));
  });

  it("skips entirely when the store has no notification email on file", async () => {
    storesFindFirst.mockResolvedValue({
      name: "Test Store",
      slug: "test-store",
      notificationEmail: null,
      notificationPreferences: { paymentFailed: true },
    });

    await handleRefundPlaced(job, ctx);

    expect(emailSend).not.toHaveBeenCalled();
  });

  it("skips when the merchant has turned off refund notifications", async () => {
    storesFindFirst.mockResolvedValue({
      name: "Test Store",
      slug: "test-store",
      notificationEmail: "owner@teststore.com",
      notificationPreferences: { paymentFailed: false },
    });

    await handleRefundPlaced(job, ctx);

    expect(emailSend).not.toHaveBeenCalled();
  });

  it("builds the dashboard link from the store's slug, not its display name", async () => {
    await handleRefundPlaced(job, ctx);

    const props = (RefundPlaced as jest.Mock).mock.calls[0][0];
    expect(props.dashboardUrl).toBe("https://commerce.sitehaus.dev/test-store/orders/order-1");
  });

  it("passes the customer's name and email through — this is about them, not to them", async () => {
    await handleRefundPlaced(job, ctx);

    const props = (RefundPlaced as jest.Mock).mock.calls[0][0];
    expect(props.customerName).toBe("Ada Lovelace");
    expect(props.customerEmail).toBe("customer@example.com");
  });
});
