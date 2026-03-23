import { Test, TestingModule } from "@nestjs/testing";
import { ReservationHandler } from "./reservation.handler";
import { ReservationService } from "./reservation.service";

describe("ReservationHandler", () => {
  let handler: ReservationHandler;
  let mockService: {
    reserve: jest.Mock;
    releaseByOrder: jest.Mock;
    commit: jest.Mock;
    expireStale: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      reserve: jest.fn(),
      releaseByOrder: jest.fn(),
      commit: jest.fn(),
      expireStale: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationHandler],
      providers: [{ provide: ReservationService, useValue: mockService }],
    }).compile();

    handler = module.get(ReservationHandler);
  });

  afterEach(() => jest.clearAllMocks());

  describe("reserve", () => {
    it("delegates to reservationService.reserve with correct args", async () => {
      mockService.reserve.mockResolvedValue("reserved");

      await handler.reserve({
        variantId: "variant-1",
        orderId: "order-1",
        storeId: "store-1",
        quantity: 3,
      });

      expect(mockService.reserve).toHaveBeenCalledWith("variant-1", "order-1", "store-1", 3);
    });

    it("returns the service result", async () => {
      mockService.reserve.mockResolvedValue("sold_out");

      const result = await handler.reserve({
        variantId: "variant-1",
        orderId: "order-1",
        storeId: "store-1",
        quantity: 1,
      });

      expect(result).toBe("sold_out");
    });
  });

  describe("releaseByOrder", () => {
    it("delegates to reservationService.releaseByOrder", async () => {
      mockService.releaseByOrder.mockResolvedValue(undefined);

      await handler.releaseByOrder({ orderId: "order-1" });

      expect(mockService.releaseByOrder).toHaveBeenCalledWith("order-1");
    });
  });

  describe("commit", () => {
    it("delegates to reservationService.commit", async () => {
      mockService.commit.mockResolvedValue(undefined);

      await handler.commit({ orderId: "order-1" });

      expect(mockService.commit).toHaveBeenCalledWith("order-1");
    });
  });

  describe("expireStale", () => {
    it("delegates to reservationService.expireStale and returns the count", async () => {
      mockService.expireStale.mockResolvedValue(12);

      const result = await handler.expireStale();

      expect(mockService.expireStale).toHaveBeenCalled();
      expect(result).toBe(12);
    });
  });
});
