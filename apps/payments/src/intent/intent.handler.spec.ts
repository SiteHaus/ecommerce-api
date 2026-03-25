import { Test, TestingModule } from "@nestjs/testing";
import { IntentHandler } from "./intent.handler";
import { IntentService } from "./intent.service";

describe("IntentHandler", () => {
  let handler: IntentHandler;
  let service: jest.Mocked<IntentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntentHandler],
      providers: [{ provide: IntentService, useValue: { createIntent: jest.fn() } }],
    }).compile();

    handler = module.get(IntentHandler);
    service = module.get(IntentService) as jest.Mocked<IntentService>;
  });

  it("delegates createIntent to the service", async () => {
    const mockResult = { clientSecret: "pi_test_secret" };
    service.createIntent.mockResolvedValue(mockResult);

    const result = await handler.createIntent({ orderId: "order-uuid-1" });

    expect(result).toEqual(mockResult);
    expect(service.createIntent).toHaveBeenCalledWith("order-uuid-1");
  });
});
