import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { StoreOwnerGuard } from "@sitehaus-ecom/auth";
import type { ResolvedStore } from "@sitehaus-ecom/auth";
import { of, throwError } from "rxjs";
import { RpcException } from "@nestjs/microservices";
import request from "supertest";
import { InventoryAdminController } from "./inventory-admin.controller";
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

const mockUser = {
  userId: "user-uuid-1",
  clientId: "client-uuid-1",
  email: "owner@example.com",
  firstName: "Test",
  lastName: "Owner",
  isVerified: true,
  status: "active",
  sessionId: "session-uuid-1",
  permissions: [],
};

const VARIANT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const inventoryBody = {
  variantId: VARIANT_ID,
  stock: 100,
  reserved: 10,
  available: 90,
  allowBackorder: false,
  reservationTtlMinutes: 15,
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

describe("InventoryAdminController", () => {
  let app: INestApplication;
  let mockCommerceClient: { send: jest.Mock };

  beforeEach(async () => {
    mockCommerceClient = { send: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [InventoryAdminController],
      providers: [{ provide: "COMMERCE_SERVICE", useValue: mockCommerceClient }],
    })
      .overrideGuard(StoreOwnerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new RpcExceptionFilter());
    app.use((_req: any, _res: any, next: any) => {
      _req.store = mockStore;
      _req.user = mockUser;
      next();
    });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ─── GET /v1/admin/inventory/:variantId ─────────────────────────────────────

  describe("GET /v1/admin/inventory/:variantId", () => {
    it("returns 200 with the inventory body", async () => {
      mockCommerceClient.send.mockReturnValue(of(inventoryBody));

      const res = await request(app.getHttpServer()).get(`/v1/admin/inventory/${VARIANT_ID}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          variantId: inventoryBody.variantId,
          stock: inventoryBody.stock,
          reserved: inventoryBody.reserved,
          available: inventoryBody.available,
          allowBackorder: inventoryBody.allowBackorder,
          reservationTtlMinutes: inventoryBody.reservationTtlMinutes,
        }),
      );
    });

    it("sends the 'inventory.get' message pattern", async () => {
      mockCommerceClient.send.mockReturnValue(of(inventoryBody));

      await request(app.getHttpServer()).get(`/v1/admin/inventory/${VARIANT_ID}`);

      expect(mockCommerceClient.send).toHaveBeenCalledWith("inventory.get", expect.any(Object));
    });

    it("includes variantId from params and storeId from req.store in the payload", async () => {
      mockCommerceClient.send.mockReturnValue(of(inventoryBody));

      await request(app.getHttpServer()).get(`/v1/admin/inventory/${VARIANT_ID}`);

      expect(mockCommerceClient.send).toHaveBeenCalledWith("inventory.get", {
        variantId: VARIANT_ID,
        storeId: mockStore.id,
      });
    });
  });

  // ─── PATCH /v1/admin/inventory/:variantId ───────────────────────────────────

  describe("PATCH /v1/admin/inventory/:variantId", () => {
    it("returns 200 with the updated inventory body", async () => {
      const updated = { ...inventoryBody, stock: 50 };
      mockCommerceClient.send.mockReturnValue(of(updated));

      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/inventory/${VARIANT_ID}`)
        .send({ stock: 50 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          stock: 50,
          variantId: VARIANT_ID,
        }),
      );
    });

    it("sends 'inventory.adjust' with variantId, storeId, and stock merged", async () => {
      mockCommerceClient.send.mockReturnValue(of({ ...inventoryBody, stock: 50 }));

      await request(app.getHttpServer())
        .patch(`/v1/admin/inventory/${VARIANT_ID}`)
        .send({ stock: 50 });

      expect(mockCommerceClient.send).toHaveBeenCalledWith("inventory.adjust", {
        variantId: VARIANT_ID,
        storeId: mockStore.id,
        stock: 50,
      });
    });

    it("passes stock body field through correctly", async () => {
      mockCommerceClient.send.mockReturnValue(of(inventoryBody));

      await request(app.getHttpServer())
        .patch(`/v1/admin/inventory/${VARIANT_ID}`)
        .send({ stock: 200 });

      const [, payload] = mockCommerceClient.send.mock.calls[0];
      expect(payload.stock).toBe(200);
    });

    it("passes allowBackorder body field through correctly", async () => {
      mockCommerceClient.send.mockReturnValue(of({ ...inventoryBody, allowBackorder: true }));

      await request(app.getHttpServer())
        .patch(`/v1/admin/inventory/${VARIANT_ID}`)
        .send({ allowBackorder: true });

      const [, payload] = mockCommerceClient.send.mock.calls[0];
      expect(payload.allowBackorder).toBe(true);
    });
  });

  // ─── RPC error propagation ──────────────────────────────────────────────────

  describe("RPC error propagation", () => {
    it("converts an RpcException with status 404 to HTTP 404", async () => {
      mockCommerceClient.send.mockReturnValue(
        throwError(() => new RpcException({ status: 404, message: "Variant not found" })),
      );

      const res = await request(app.getHttpServer()).get(`/v1/admin/inventory/${VARIANT_ID}`);

      expect(res.status).toBe(404);
    });

    it("converts an RpcException with status 400 to HTTP 400", async () => {
      mockCommerceClient.send.mockReturnValue(
        throwError(
          () =>
            new RpcException({
              status: 400,
              message: "Stock cannot be less than reserved",
            }),
        ),
      );

      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/inventory/${VARIANT_ID}`)
        .send({ stock: 1 });

      expect(res.status).toBe(400);
    });

    it("includes the error message in the response body", async () => {
      mockCommerceClient.send.mockReturnValue(
        throwError(() => new RpcException({ status: 404, message: "Variant not found" })),
      );

      const res = await request(app.getHttpServer()).get(`/v1/admin/inventory/${VARIANT_ID}`);

      expect(res.body.message).toBe("Variant not found");
    });
  });
});
