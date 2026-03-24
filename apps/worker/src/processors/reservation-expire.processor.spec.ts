import { Test, TestingModule } from "@nestjs/testing";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { ReservationExpireProcessor } from "./reservation-expire.processor";

describe("ReservationExpireProcessor", () => {
  let processor: ReservationExpireProcessor;
  let mockExecute: jest.Mock;

  beforeEach(async () => {
    mockExecute = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationExpireProcessor,
        { provide: DB_TOKEN, useValue: { execute: mockExecute } },
      ],
    }).compile();

    processor = module.get(ReservationExpireProcessor);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── process ────────────────────────────────────────────────────────────────

  describe("process", () => {
    it("ignores jobs that are not reservation.expire and never calls execute", async () => {
      await processor.process({ name: "some.other.job" } as any);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("calls execute for a reservation.expire job", async () => {
      mockExecute.mockResolvedValue({ rows: [{ released: 0 }] });

      await processor.process({ name: "reservation.expire" } as any);

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it("does NOT log when released count is 0", async () => {
      mockExecute.mockResolvedValue({ rows: [{ released: 0 }] });
      const logSpy = jest
        .spyOn((processor as any).logger, "log")
        .mockImplementation(() => undefined);

      await processor.process({ name: "reservation.expire" } as any);

      expect(logSpy).not.toHaveBeenCalled();
    });

    it("logs the correct count when reservations were released", async () => {
      mockExecute.mockResolvedValue({ rows: [{ released: 5 }] });
      const logSpy = jest
        .spyOn((processor as any).logger, "log")
        .mockImplementation(() => undefined);

      await processor.process({ name: "reservation.expire" } as any);

      expect(logSpy).toHaveBeenCalledWith("Released 5 expired reservations");
    });
  });

  // ─── expireStale (via process) ───────────────────────────────────────────────

  describe("expireStale (indirectly via process)", () => {
    it("returns 0 when rows[0].released is undefined (rows: [{}])", async () => {
      mockExecute.mockResolvedValue({ rows: [{}] });
      const logSpy = jest
        .spyOn((processor as any).logger, "log")
        .mockImplementation(() => undefined);

      // Process the job — if released resolves to 0 no log is emitted
      await processor.process({ name: "reservation.expire" } as any);

      expect(logSpy).not.toHaveBeenCalled();
    });

    it("returns correct count when rows[0].released = 7 and logs accordingly", async () => {
      mockExecute.mockResolvedValue({ rows: [{ released: 7 }] });
      const logSpy = jest
        .spyOn((processor as any).logger, "log")
        .mockImplementation(() => undefined);

      await processor.process({ name: "reservation.expire" } as any);

      expect(logSpy).toHaveBeenCalledWith("Released 7 expired reservations");
    });

    it("returns 0 (no log) when the CTE returns no rows at all", async () => {
      mockExecute.mockResolvedValue({ rows: [] });
      const logSpy = jest
        .spyOn((processor as any).logger, "log")
        .mockImplementation(() => undefined);

      await processor.process({ name: "reservation.expire" } as any);

      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
