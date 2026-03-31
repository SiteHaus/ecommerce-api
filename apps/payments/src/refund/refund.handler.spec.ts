import { Test, TestingModule } from "@nestjs/testing";
import { RefundHandler } from "./refund.handler";
import { RefundService } from "./refund.service";

describe("RefundHandler", () => {
  let handler: RefundHandler;
  let service: jest.Mocked<RefundService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RefundHandler],
      providers: [{ provide: RefundService, useValue: { refund: jest.fn() } }],
    }).compile();

    handler = module.get(RefundHandler);
    service = module.get(RefundService) as jest.Mocked<RefundService>;
  });

  it("delegates handleRefund to the service with full payload", async () => {
    const mockResult = { id: "order-1", status: "refunded" };
    service.refund.mockResolvedValue(mockResult as any);

    const payload = {
      storeId: "store-1",
      orderId: "order-1",
      store: { stripeAccountId: "acct_test123" },
    };

    const result = await handler.handleRefund(payload);

    expect(result).toEqual(mockResult);
    expect(service.refund).toHaveBeenCalledWith(payload);
  });
});
