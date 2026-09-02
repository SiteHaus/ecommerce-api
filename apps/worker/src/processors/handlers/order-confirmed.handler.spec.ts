import { of } from "rxjs";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { OrderConfirmed } from "@sitehaus-ecom/email-templates";
import { handleOrderConfirmed } from "./order-confirmed.handler";
import type { HandlerContext } from "./handler.context";

jest.mock("@react-email/render", () => ({
  render: jest.fn().mockResolvedValue("<html></html>"),
}));

jest.mock("@sitehaus-ecom/email-templates", () => ({
  OrderConfirmed: jest.fn().mockReturnValue("order-confirmed-element"),
}));

describe("handleOrderConfirmed", () => {
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

    await handleOrderConfirmed(job, ctx);

    const props = (OrderConfirmed as jest.Mock).mock.calls[0][0];
    expect(props.shippingLine1).toBe("12 Baker St");
    expect(props.shippingLine2).toBe("Flat 4");
  });

  // A confirmation email is the customer's receipt for where the parcel is going. Every
  // component has to be on it — a street with no city is as useless as no street at all.
  it("renders the complete address: Stripe's street plus the columns' name/city/state/zip/country", async () => {
    dbFindFirst.mockResolvedValue({
      ...baseOrder,
      shippingName: "Ada Lovelace",
      shippingLine1: null,
      shippingLine2: null,
      shippingCity: "Provo",
      shippingState: "UT",
      shippingZip: "84604",
      shippingCountry: "US",
    });
    paymentsSend.mockReturnValue(of({ line1: "440 Sansome St", line2: "Suite 200" }));

    await handleOrderConfirmed(job, ctx);

    const props = (OrderConfirmed as jest.Mock).mock.calls[0][0];
    expect(props).toMatchObject({
      shippingName: "Ada Lovelace",
      shippingLine1: "440 Sansome St",
      shippingLine2: "Suite 200",
      shippingCity: "Provo",
      shippingState: "UT",
      shippingZip: "84604",
      shippingCountry: "US",
    });
  });

  it("renders the legacy columns' street when Stripe has none", async () => {
    paymentsSend.mockReturnValue(of({ line1: null, line2: null }));

    await handleOrderConfirmed(job, ctx);

    const props = (OrderConfirmed as jest.Mock).mock.calls[0][0];
    expect(props.shippingLine1).toBe("10 Analytical Engine Way");
    expect(props.shippingCity).toBe("London");
    expect(props.shippingZip).toBe("SW1A 1AA");
  });

  // The template takes strings for the required lines; an absent street must arrive as ""
  // rather than "undefined" being rendered into the customer's receipt.
  it("sends an empty string, never undefined, when no street exists anywhere", async () => {
    dbFindFirst.mockResolvedValue({ ...baseOrder, shippingLine1: null, shippingLine2: null });
    paymentsSend.mockReturnValue(of({ line1: null, line2: null }));

    await handleOrderConfirmed(job, ctx);

    const props = (OrderConfirmed as jest.Mock).mock.calls[0][0];
    expect(props.shippingLine1).toBe("");
    expect(props.shippingCity).toBe("London");
  });
});
