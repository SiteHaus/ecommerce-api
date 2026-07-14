import { of, throwError } from "rxjs";
import { Logger } from "@nestjs/common";
import { getShippingStreet } from "./get-shipping-street";
import type { HandlerContext } from "./handler.context";

describe("getShippingStreet", () => {
  let paymentsSend: jest.Mock;
  let ctx: HandlerContext;

  beforeEach(() => {
    paymentsSend = jest.fn();
    ctx = {
      db: {} as HandlerContext["db"],
      email: {} as HandlerContext["email"],
      logger: { warn: jest.fn() } as unknown as Logger,
      payments: { send: paymentsSend } as unknown as HandlerContext["payments"],
    };
  });

  it("prefers the street from Stripe", async () => {
    paymentsSend.mockReturnValue(of({ line1: "12 Baker St", line2: "Flat 4" }));

    await expect(
      getShippingStreet(ctx, { id: "o1", shippingLine1: null, shippingLine2: null }),
    ).resolves.toEqual({ line1: "12 Baker St", line2: "Flat 4" });
  });

  it("falls back to the columns for a legacy order Stripe knows nothing about", async () => {
    paymentsSend.mockReturnValue(of({ line1: null, line2: null }));

    await expect(
      getShippingStreet(ctx, { id: "o1", shippingLine1: "9 Old Rd", shippingLine2: null }),
    ).resolves.toEqual({ line1: "9 Old Rd", line2: null });
  });

  it("falls back to the columns when payments is unreachable — never loses a receipt", async () => {
    paymentsSend.mockReturnValue(throwError(() => new Error("ECONNREFUSED")));

    await expect(
      getShippingStreet(ctx, { id: "o1", shippingLine1: "9 Old Rd", shippingLine2: null }),
    ).resolves.toEqual({ line1: "9 Old Rd", line2: null });
  });
});
