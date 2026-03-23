import { Test, TestingModule } from "@nestjs/testing";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { ReservationService } from "./reservation.service";

const VARIANT_ID = "variant-uuid-1";
const ORDER_ID = "order-uuid-1";
const STORE_ID = "store-uuid-1";

describe("ReservationService", () => {
  let service: ReservationService;
  let mockExecute: jest.Mock;

  beforeEach(async () => {
    mockExecute = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReservationService, { provide: DB_TOKEN, useValue: { execute: mockExecute } }],
    }).compile();

    service = module.get(ReservationService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── reserve ────────────────────────────────────────────────────────────────

  describe("reserve", () => {
    it("returns 'reserved' when inventory is available", async () => {
      // First call: fetch store TTL
      mockExecute.mockResolvedValueOnce({
        rows: [{ reservation_ttl_minutes: 15 }],
      });
      // Second call: atomic CTE — row returned means reserved
      mockExecute.mockResolvedValueOnce({
        rows: [{ id: "reservation-uuid-1" }],
      });

      const result = await service.reserve(VARIANT_ID, ORDER_ID, STORE_ID, 2);

      expect(result).toBe("reserved");
    });

    it("returns 'sold_out' when no rows come back from the CTE", async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ reservation_ttl_minutes: 15 }],
      });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.reserve(VARIANT_ID, ORDER_ID, STORE_ID, 2);

      expect(result).toBe("sold_out");
    });

    it("falls back to 15-minute TTL when store row is missing", async () => {
      // Store not found (no rows)
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({
        rows: [{ id: "reservation-uuid-1" }],
      });

      await service.reserve(VARIANT_ID, ORDER_ID, STORE_ID, 1);

      // Should still reach the CTE call without throwing
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it("executes exactly two DB calls: TTL fetch then CTE", async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ reservation_ttl_minutes: 5 }],
      });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      await service.reserve(VARIANT_ID, ORDER_ID, STORE_ID, 1);

      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  // ─── releaseByOrder ─────────────────────────────────────────────────────────

  describe("releaseByOrder", () => {
    it("executes the release CTE once", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      await service.releaseByOrder(ORDER_ID);

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it("resolves without error when no reservations exist for the order", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      await expect(service.releaseByOrder(ORDER_ID)).resolves.toBeUndefined();
    });
  });

  // ─── commit ─────────────────────────────────────────────────────────────────

  describe("commit", () => {
    it("executes the commit CTE once", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      await service.commit(ORDER_ID);

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it("resolves without error", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      await expect(service.commit(ORDER_ID)).resolves.toBeUndefined();
    });
  });

  // ─── expireStale ────────────────────────────────────────────────────────────

  describe("expireStale", () => {
    it("returns the count of expired reservations from the CTE", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [{ released: 7 }] });

      const count = await service.expireStale();

      expect(count).toBe(7);
    });

    it("returns 0 when no reservations were expired", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [{ released: 0 }] });

      const count = await service.expireStale();

      expect(count).toBe(0);
    });

    it("returns 0 when the CTE returns no rows (safety fallback)", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const count = await service.expireStale();

      expect(count).toBe(0);
    });
  });
});
