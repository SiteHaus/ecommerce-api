import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import type { ResolvedStore } from "@sitehaus-ecom/auth";
import { of, throwError } from "rxjs";
import { RpcException } from "@nestjs/microservices";
import request from "supertest";
import { CartController } from "./cart.controller";
import { RpcExceptionFilter } from "../filters/rpc-exception.filter";

const mockStore: ResolvedStore = {
  id: "store-uuid-1",
  clientId: "client-uuid-1",
  slug: "test-store",
  domain: null,
  currency: "usd",
  stripeAccountId: null,
  stripeChargesEnabled: false,
  stripePayoutsEnabled: false,
  stripeDetailsSubmitted: false,
  reservationTtlMinutes: 15,
};

const VARIANT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const emptyCart = {
  id: null,
  items: [],
  subtotalCents: 0,
  itemCount: 0,
  expiresAt: null,
};

const cartWithItem = {
  id: "cart-uuid-1",
  items: [
    {
      variantId: VARIANT_ID,
      productId: "product-uuid-1",
      productName: "Test Product",
      variantName: "Default",
      sku: "SKU-001",
      priceCents: 2000,
      compareAtCents: null,
      primaryImageUrl: null,
      quantity: 2,
      lineTotalCents: 4000,
      availability: "in_stock",
    },
  ],
  subtotalCents: 4000,
  itemCount: 2,
  expiresAt: "2024-01-08T00:00:00.000Z",
};

describe("CartController", () => {
  let app: INestApplication;
  let mockCommerceClient: { send: jest.Mock };
  let sessionToken: string;
  let userId: string | undefined;

  beforeEach(async () => {
    sessionToken = "session-abc";
    userId = undefined;
    mockCommerceClient = { send: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: "COMMERCE_SERVICE", useValue: mockCommerceClient }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new RpcExceptionFilter());
    app.use((_req: any, _res: any, next: any) => {
      _req.store = mockStore;
      _req.anonSession = { sub: sessionToken };
      if (userId) _req.user = { userId };
      next();
    });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ─── GET /v1/cart ───────────────────────────────────────────────────────────

  describe("GET /v1/cart", () => {
    it("returns 200 with the cart body for an anonymous user", async () => {
      mockCommerceClient.send.mockReturnValue(of(emptyCart));

      const res = await request(app.getHttpServer()).get("/v1/cart");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(emptyCart);
    });

    it("sends 'cart.get' with storeId, sessionToken, and userId undefined for anon user", async () => {
      mockCommerceClient.send.mockReturnValue(of(emptyCart));

      await request(app.getHttpServer()).get("/v1/cart");

      expect(mockCommerceClient.send).toHaveBeenCalledWith("cart.get", {
        storeId: mockStore.id,
        sessionToken,
        userId: undefined,
      });
    });

    it("does NOT send 'cart.merge' for an anonymous user", async () => {
      mockCommerceClient.send.mockReturnValue(of(emptyCart));

      await request(app.getHttpServer()).get("/v1/cart");

      const calls = mockCommerceClient.send.mock.calls.map(([pattern]) => pattern);
      expect(calls).not.toContain("cart.merge");
    });

    it("sends 'cart.merge' before 'cart.get' when userId is present", async () => {
      userId = "user-uuid-1";
      mockCommerceClient.send
        .mockReturnValueOnce(of(undefined)) // merge
        .mockReturnValueOnce(of(emptyCart)); // get

      await request(app.getHttpServer()).get("/v1/cart");

      const patterns = mockCommerceClient.send.mock.calls.map(([p]) => p);
      expect(patterns[0]).toBe("cart.merge");
      expect(patterns[1]).toBe("cart.get");
    });

    it("still returns 200 when merge throws an error (best-effort merge)", async () => {
      userId = "user-uuid-1";
      mockCommerceClient.send
        .mockReturnValueOnce(
          throwError(() => new RpcException({ status: 500, message: "Merge failed" })),
        )
        .mockReturnValueOnce(of(emptyCart));

      const res = await request(app.getHttpServer()).get("/v1/cart");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(emptyCart);
    });
  });

  // ─── POST /v1/cart/items ────────────────────────────────────────────────────

  describe("POST /v1/cart/items", () => {
    it("returns 200 with the updated cart body", async () => {
      mockCommerceClient.send.mockReturnValue(of(cartWithItem));

      const res = await request(app.getHttpServer())
        .post("/v1/cart/items")
        .send({ variantId: VARIANT_ID, quantity: 2 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(cartWithItem);
    });

    it("sends 'cart.addItem' with identity and body fields merged", async () => {
      mockCommerceClient.send.mockReturnValue(of(cartWithItem));

      await request(app.getHttpServer())
        .post("/v1/cart/items")
        .send({ variantId: VARIANT_ID, quantity: 2 });

      expect(mockCommerceClient.send).toHaveBeenCalledWith("cart.addItem", {
        storeId: mockStore.id,
        sessionToken,
        userId: undefined,
        variantId: VARIANT_ID,
        quantity: 2,
      });
    });

    it("does not send cart.merge for anon addItem", async () => {
      mockCommerceClient.send.mockReturnValue(of(cartWithItem));

      await request(app.getHttpServer())
        .post("/v1/cart/items")
        .send({ variantId: VARIANT_ID, quantity: 1 });

      const patterns = mockCommerceClient.send.mock.calls.map(([p]) => p);
      expect(patterns).not.toContain("cart.merge");
    });
  });

  // ─── PATCH /v1/cart/items/:variantId ────────────────────────────────────────

  describe("PATCH /v1/cart/items/:variantId", () => {
    it("returns 200 with the updated cart body", async () => {
      mockCommerceClient.send.mockReturnValue(of(cartWithItem));

      const res = await request(app.getHttpServer())
        .patch(`/v1/cart/items/${VARIANT_ID}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(cartWithItem);
    });

    it("sends 'cart.updateItem' with identity, variantId from params, and quantity from body", async () => {
      mockCommerceClient.send.mockReturnValue(of(cartWithItem));

      await request(app.getHttpServer())
        .patch(`/v1/cart/items/${VARIANT_ID}`)
        .send({ quantity: 5 });

      expect(mockCommerceClient.send).toHaveBeenCalledWith("cart.updateItem", {
        storeId: mockStore.id,
        sessionToken,
        userId: undefined,
        variantId: VARIANT_ID,
        quantity: 5,
      });
    });
  });

  // ─── DELETE /v1/cart/items/:variantId ───────────────────────────────────────

  describe("DELETE /v1/cart/items/:variantId", () => {
    it("returns 200 with the updated cart body", async () => {
      mockCommerceClient.send.mockReturnValue(of(emptyCart));

      const res = await request(app.getHttpServer()).delete(`/v1/cart/items/${VARIANT_ID}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(emptyCart);
    });

    it("sends 'cart.removeItem' with identity and variantId from params", async () => {
      mockCommerceClient.send.mockReturnValue(of(emptyCart));

      await request(app.getHttpServer()).delete(`/v1/cart/items/${VARIANT_ID}`);

      expect(mockCommerceClient.send).toHaveBeenCalledWith("cart.removeItem", {
        storeId: mockStore.id,
        sessionToken,
        userId: undefined,
        variantId: VARIANT_ID,
      });
    });
  });

  // ─── RPC error propagation ──────────────────────────────────────────────────

  describe("RPC error propagation", () => {
    it("converts an RpcException with status 404 to HTTP 404", async () => {
      mockCommerceClient.send.mockReturnValue(
        throwError(() => new RpcException({ status: 404, message: "Cart not found" })),
      );

      const res = await request(app.getHttpServer()).get("/v1/cart");

      expect(res.status).toBe(404);
    });

    it("converts an RpcException with status 400 to HTTP 400", async () => {
      mockCommerceClient.send.mockReturnValue(
        throwError(
          () =>
            new RpcException({
              status: 400,
              message: "Variant is not active",
            }),
        ),
      );

      const res = await request(app.getHttpServer())
        .post("/v1/cart/items")
        .send({ variantId: VARIANT_ID, quantity: 1 });

      expect(res.status).toBe(400);
    });

    it("includes the error message in the response body", async () => {
      mockCommerceClient.send.mockReturnValue(
        throwError(() => new RpcException({ status: 404, message: "Cart not found" })),
      );

      const res = await request(app.getHttpServer()).get("/v1/cart");

      expect(res.body.message).toBe("Cart not found");
    });
  });
});
