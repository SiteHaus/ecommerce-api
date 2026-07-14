import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import type { ResolvedStore } from "@sitehaus-ecom/auth";
import { of, throwError } from "rxjs";
import { RpcException } from "@nestjs/microservices";
import request from "supertest";
import { CheckoutController } from "./checkout.controller";
import { RpcExceptionFilter } from "../filters/rpc-exception.filter";

const mockStore: ResolvedStore = {
  id: "store-uuid-1",
  clientId: "client-uuid-1",
  slug: "test-store",
  domain: null,
  currency: "usd",
  stripeAccountId: "acct_test",
  stripeChargesEnabled: true,
  stripePayoutsEnabled: false,
  stripeDetailsSubmitted: true,
  reservationTtlMinutes: 15,
  fulfillmentType: "shipping" as const,
  notificationEmail: null,
  notificationPreferences: null,
};

const validBody = {
  email: "customer@example.com",
  address: {
    name: "Jane Doe",
    line1: "456 Oak Ave",
    city: "Vancouver",
    state: "BC",
    zip: "V6B 1A1",
    country: "CA",
  },
  successUrl: "https://example.com/success",
  cancelUrl: "https://example.com/cancel",
};

const mockOrderResult = {
  orderId: "order-uuid-1",
  subtotalCents: 4000,
  shippingCents: 0,
  totalCents: 4000,
  currency: "usd",
};

const mockIntentResult = { checkoutUrl: "https://checkout.stripe.com/pay/test_session_xyz" };

describe("CheckoutController", () => {
  let app: INestApplication;
  let mockCommerceClient: { send: jest.Mock };
  let mockPaymentsClient: { send: jest.Mock };

  beforeEach(async () => {
    mockCommerceClient = { send: jest.fn() };
    mockPaymentsClient = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckoutController],
      providers: [
        { provide: "COMMERCE_SERVICE", useValue: mockCommerceClient },
        { provide: "PAYMENTS_SERVICE", useValue: mockPaymentsClient },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new RpcExceptionFilter());
    app.use((req: any, _res: any, next: any) => {
      req.store = mockStore;
      req.anonSession = { sub: "session-token-abc" };
      next();
    });
    await app.init();
  });

  afterEach(() => app.close());

  it("POST /v1/checkout/intent — returns 201 with orderId and checkoutUrl", async () => {
    mockCommerceClient.send.mockReturnValue(of(mockOrderResult));
    mockPaymentsClient.send.mockReturnValue(of(mockIntentResult));

    const res = await request(app.getHttpServer())
      .post("/v1/checkout/intent")
      .send(validBody)
      .expect(201);

    expect(res.body.orderId).toBe("order-uuid-1");
    expect(res.body.checkoutUrl).toBe("https://checkout.stripe.com/pay/test_session_xyz");
    expect(res.body.totalCents).toBe(4000);
  });

  it("forwards storeId, sessionToken, and address to commerce service", async () => {
    mockCommerceClient.send.mockReturnValue(of(mockOrderResult));
    mockPaymentsClient.send.mockReturnValue(of(mockIntentResult));

    await request(app.getHttpServer()).post("/v1/checkout/intent").send(validBody);

    expect(mockCommerceClient.send).toHaveBeenCalledWith(
      "checkout.createOrder",
      expect.objectContaining({
        storeId: mockStore.id,
        sessionToken: "session-token-abc",
        email: validBody.email,
        shippingName: validBody.address.name,
        shippingCity: validBody.address.city,
        shippingCountry: validBody.address.country,
      }),
    );
  });

  it("passes orderId, successUrl, and cancelUrl to payments service", async () => {
    mockCommerceClient.send.mockReturnValueOnce(of(mockOrderResult)).mockReturnValueOnce(of(null));
    mockPaymentsClient.send.mockReturnValue(of(mockIntentResult));

    await request(app.getHttpServer()).post("/v1/checkout/intent").send(validBody);

    expect(mockPaymentsClient.send).toHaveBeenCalledWith("stripe.intent.create", {
      orderId: "order-uuid-1",
      cartId: undefined,
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
      stripeCouponId: null,
      shipping: {
        name: validBody.address.name,
        line1: validBody.address.line1,
        line2: undefined,
        city: validBody.address.city,
        state: validBody.address.state,
        zip: validBody.address.zip,
        country: validBody.address.country,
      },
    });
  });

  it("returns 400 when commerce reports out-of-stock items", async () => {
    mockCommerceClient.send.mockReturnValue(
      throwError(() => new RpcException({ status: 400, message: "Vitamin C is out of stock" })),
    );

    const res = await request(app.getHttpServer())
      .post("/v1/checkout/intent")
      .send(validBody)
      .expect(400);

    expect(res.body.message).toMatch(/out of stock/i);
  });

  it("returns 400 when payments reports Stripe not configured", async () => {
    mockCommerceClient.send.mockReturnValue(of(mockOrderResult));
    mockPaymentsClient.send.mockReturnValue(
      throwError(
        () =>
          new RpcException({ status: 400, message: "Store payment processing is not configured" }),
      ),
    );

    await request(app.getHttpServer()).post("/v1/checkout/intent").send(validBody).expect(400);
  });

  it("sends the street to payments and NOT to commerce", async () => {
    mockCommerceClient.send.mockReturnValue(of(mockOrderResult));
    mockPaymentsClient.send.mockReturnValue(of(mockIntentResult));

    const fullCheckoutBody = {
      email: "customer@example.com",
      address: {
        name: "Ada Lovelace",
        line1: "12 Baker St",
        line2: "Flat 4",
        city: "Provo",
        state: "UT",
        zip: "84604",
        country: "US",
      },
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    };

    await request(app.getHttpServer()).post("/v1/checkout/intent").send(fullCheckoutBody);

    const createOrderPayload = mockCommerceClient.send.mock.calls.find(
      ([pattern]) => pattern === "checkout.createOrder",
    )![1];
    // The whole point: the street never reaches the service that owns the database.
    expect(createOrderPayload).not.toHaveProperty("shippingLine1");
    expect(createOrderPayload).not.toHaveProperty("shippingLine2");
    expect(createOrderPayload.shippingCity).toBe("Provo"); // city/state/zip still persisted

    const intentPayload = mockPaymentsClient.send.mock.calls.find(
      ([pattern]) => pattern === "stripe.intent.create",
    )![1];
    expect(intentPayload.shipping).toEqual({
      name: "Ada Lovelace",
      line1: "12 Baker St",
      line2: "Flat 4",
      city: "Provo",
      state: "UT",
      zip: "84604",
      country: "US",
    });
  });
});
