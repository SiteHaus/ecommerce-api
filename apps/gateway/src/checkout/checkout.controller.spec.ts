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
};

const mockOrderResult = {
  orderId: "order-uuid-1",
  subtotalCents: 4000,
  shippingCents: 0,
  totalCents: 4000,
  currency: "usd",
};

const mockIntentResult = { clientSecret: "pi_test_secret_xyz" };

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

  it("POST /v1/checkout/intent — returns 201 with orderId and clientSecret", async () => {
    mockCommerceClient.send.mockReturnValue(of(mockOrderResult));
    mockPaymentsClient.send.mockReturnValue(of(mockIntentResult));

    const res = await request(app.getHttpServer())
      .post("/v1/checkout/intent")
      .send(validBody)
      .expect(201);

    expect(res.body.orderId).toBe("order-uuid-1");
    expect(res.body.clientSecret).toBe("pi_test_secret_xyz");
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
        shippingLine1: validBody.address.line1,
        shippingCity: validBody.address.city,
        shippingCountry: validBody.address.country,
      }),
    );
  });

  it("passes orderId from commerce to payments service", async () => {
    mockCommerceClient.send.mockReturnValue(of(mockOrderResult));
    mockPaymentsClient.send.mockReturnValue(of(mockIntentResult));

    await request(app.getHttpServer()).post("/v1/checkout/intent").send(validBody);

    expect(mockPaymentsClient.send).toHaveBeenCalledWith("stripe.intent.create", {
      orderId: "order-uuid-1",
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
});
