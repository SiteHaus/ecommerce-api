import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { LowStock } from "@sitehaus-ecom/email-templates";
import { handleLowStock } from "./low-stock.handler";
import type { HandlerContext } from "./handler.context";

jest.mock("@react-email/render", () => ({
  render: jest.fn().mockResolvedValue("<html></html>"),
}));

jest.mock("@sitehaus-ecom/email-templates", () => ({
  LowStock: jest.fn().mockReturnValue("low-stock-element"),
}));

function selectChain(rows: any[]) {
  return {
    from: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

describe("handleLowStock", () => {
  let storesFindFirst: jest.Mock;
  let selectFn: jest.Mock;
  let emailSend: jest.Mock;
  let insertValues: jest.Mock;
  let ctx: HandlerContext;
  let job: Job;

  const baseVariant = {
    variantName: "60 Capsules",
    sku: "ESS-MAG-60",
    productName: "Essential Mag",
  };
  const baseStore = {
    name: "OneHealth",
    notificationEmail: "ops@onehealthclinics.com",
    notificationPreferences: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    storesFindFirst = jest.fn().mockResolvedValue(baseStore);
    selectFn = jest.fn().mockReturnValue(selectChain([baseVariant]));
    emailSend = jest.fn().mockResolvedValue(undefined);
    insertValues = jest.fn().mockResolvedValue(undefined);

    ctx = {
      db: {
        query: { storesTable: { findFirst: storesFindFirst } },
        select: selectFn,
        insert: jest.fn().mockReturnValue({ values: insertValues }),
      } as unknown as HandlerContext["db"],
      email: {
        send: emailSend,
        orderFrom: (name: string) => `${name} <notify@sitehaus.dev>`,
      } as unknown as HandlerContext["email"],
      logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() } as unknown as Logger,
      payments: {} as HandlerContext["payments"],
    };

    job = {
      data: {
        storeId: "store-1",
        variantId: "variant-1",
        stock: 4,
        reserved: 0,
        available: 4,
        lowStockThreshold: 5,
      },
    } as unknown as Job;
  });

  it("sends the merchant notification with the right product details and subject", async () => {
    await handleLowStock(job, ctx);

    expect(emailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ops@onehealthclinics.com",
        subject: "Low stock — Essential Mag (60 Capsules)",
      }),
    );
    const props = (LowStock as jest.Mock).mock.calls[0][0];
    expect(props).toMatchObject({
      storeName: "OneHealth",
      productName: "Essential Mag",
      variantName: "60 Capsules",
      sku: "ESS-MAG-60",
      stock: 4,
      available: 4,
      lowStockThreshold: 5,
    });
  });

  it("skips entirely when the store has no notification email on file", async () => {
    storesFindFirst.mockResolvedValue({ ...baseStore, notificationEmail: null });

    await handleLowStock(job, ctx);

    expect(emailSend).not.toHaveBeenCalled();
  });

  it("skips when the merchant has opted out of lowStock notifications", async () => {
    storesFindFirst.mockResolvedValue({
      ...baseStore,
      notificationPreferences: { lowStock: false },
    });

    await handleLowStock(job, ctx);

    expect(emailSend).not.toHaveBeenCalled();
  });

  it("sends when notificationPreferences.lowStock is unset (opt-out default, not opt-in)", async () => {
    storesFindFirst.mockResolvedValue({
      ...baseStore,
      notificationPreferences: { newOrder: true },
    });

    await handleLowStock(job, ctx);

    expect(emailSend).toHaveBeenCalled();
  });

  it("logs an error and skips sending when the variant can't be found", async () => {
    selectFn.mockReturnValue(selectChain([]));

    await handleLowStock(job, ctx);

    expect(emailSend).not.toHaveBeenCalled();
    expect(ctx.logger.error).toHaveBeenCalled();
  });

  it("logs a failed notification when the send throws", async () => {
    emailSend.mockRejectedValue(new Error("Resend is down"));

    await handleLowStock(job, ctx);

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ event: "merchant.low_stock", status: "failed" }),
    );
  });

  it("logs a sent notification on success", async () => {
    await handleLowStock(job, ctx);

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ event: "merchant.low_stock", status: "sent" }),
    );
  });
});
