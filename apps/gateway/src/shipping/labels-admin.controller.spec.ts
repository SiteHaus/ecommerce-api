import { Test } from "@nestjs/testing";
import { of } from "rxjs";
import { LabelsAdminController } from "./labels-admin.controller";
import { AdminStoreGuard } from "../store/admin-store.guard";
import { CommercePermGuard } from "../store/commerce-perm.guard";

/**
 * `@TsRestHandler`-decorated methods return the *unexecuted* ts-rest handler
 * function — the `TsRestHandlerInterceptor` (wired in by the decorator) is
 * what actually invokes it with the request's validated params/query/body at
 * real HTTP request time. Calling the controller method directly in a unit
 * test therefore yields that handler function, not its result — so tests
 * call the controller method to get the handler, then invoke the handler
 * themselves with a `{ params, query, body }` bag shaped like what the
 * interceptor would build from the real request. This matches how every
 * other `@TsRestHandler` route in this codebase actually executes; skipping
 * this step would make the controller return `{status, body}` directly,
 * which breaks the real interceptor (it always calls the returned value as
 * a function).
 */
describe("LabelsAdminController.getRates", () => {
  it("ensures the EasyPost account and billing setup, then returns every rate", async () => {
    const commerce = {
      send: jest.fn().mockImplementation((pattern: string) => {
        if (pattern === "shipping.ensureEasypostAccount") return of({ ready: true });
        if (pattern === "shipping.getLabelRates") {
          return of({
            shipmentId: "shp_1",
            rates: [
              {
                rateId: "rate_1",
                carrier: "USPS",
                service: "Priority",
                amountCents: 842,
                estimatedDays: 2,
              },
              {
                rateId: "rate_2",
                carrier: "UPS",
                service: "Ground",
                amountCents: 1110,
                estimatedDays: null,
              },
            ],
          });
        }
        return of(null);
      }),
    };
    const payments = {
      send: jest
        .fn()
        .mockReturnValue(of({ stripeCustomerId: "cus_1", hasDefaultPaymentMethod: true })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [LabelsAdminController],
      providers: [
        { provide: "COMMERCE_SERVICE", useValue: commerce },
        { provide: "PAYMENTS_SERVICE", useValue: payments },
      ],
    })
      .overrideGuard(AdminStoreGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CommercePermGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(LabelsAdminController);
    const req = { store: { id: "store-1" }, params: { orderId: "o1" } } as any;

    const handler: any = await controller.getRates(req);
    const result: any = await handler({ params: req.params, query: {}, body: {} });

    expect(commerce.send).toHaveBeenCalledWith("shipping.ensureEasypostAccount", {
      storeId: "store-1",
    });
    expect(payments.send).toHaveBeenCalledWith(
      "payments.postage.getBillingSetup",
      expect.objectContaining({ storeId: "store-1" }),
    );
    expect(result.body.rates).toHaveLength(2);
  });

  it("returns a billing-setup URL instead of rates when there's no card on file", async () => {
    const commerce = { send: jest.fn().mockReturnValue(of({ ready: true })) };
    const payments = {
      send: jest.fn().mockReturnValue(
        of({
          stripeCustomerId: "cus_1",
          hasDefaultPaymentMethod: false,
          setupUrl: "https://checkout.stripe.com/setup/x",
        }),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [LabelsAdminController],
      providers: [
        { provide: "COMMERCE_SERVICE", useValue: commerce },
        { provide: "PAYMENTS_SERVICE", useValue: payments },
      ],
    })
      .overrideGuard(AdminStoreGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CommercePermGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(LabelsAdminController);
    const req = { store: { id: "store-1" }, params: { orderId: "o1" } } as any;

    const handler: any = await controller.getRates(req);
    const result: any = await handler({ params: req.params, query: {}, body: {} });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe("billing_setup_required");
    expect(result.body.setupUrl).toBe("https://checkout.stripe.com/setup/x");
  });
});

describe("LabelsAdminController.buyLabel", () => {
  it("proxies the chosen shipment/rate straight through — no onboarding re-check", async () => {
    const commerce = {
      send: jest.fn().mockReturnValue(
        of({
          orderId: "o1",
          carrier: "USPS",
          service: "Priority",
          trackingCode: "9400",
          labelUrl: "https://x",
        }),
      ),
    };
    const payments = { send: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [LabelsAdminController],
      providers: [
        { provide: "COMMERCE_SERVICE", useValue: commerce },
        { provide: "PAYMENTS_SERVICE", useValue: payments },
      ],
    })
      .overrideGuard(AdminStoreGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CommercePermGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(LabelsAdminController);
    const req = { store: { id: "store-1" }, params: { orderId: "o1" } } as any;

    const handler: any = await controller.buyLabel(req);
    const result: any = await handler({
      params: req.params,
      body: { shipmentId: "shp_1", rateId: "rate_1" },
    });

    expect(commerce.send).toHaveBeenCalledWith(
      "shipping.buyLabel",
      expect.objectContaining({ orderId: "o1", shipmentId: "shp_1", rateId: "rate_1" }),
    );
    expect(payments.send).not.toHaveBeenCalled();
    expect(result.body.trackingCode).toBe("9400");
  });
});
