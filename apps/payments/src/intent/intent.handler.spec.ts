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

  it("delegates createIntent to the service with all args", async () => {
    const mockResult = { checkoutUrl: "https://checkout.stripe.com/pay/test" };
    service.createIntent.mockResolvedValue(mockResult);

    const result = await handler.createIntent({
      orderId: "order-uuid-1",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(result).toEqual(mockResult);
    expect(service.createIntent).toHaveBeenCalledWith(
      "order-uuid-1",
      "https://example.com/success",
      "https://example.com/cancel",
      undefined,
      null,
      undefined,
    );
  });

  it("passes shipping through to the service", async () => {
    const mockResult = { checkoutUrl: "https://checkout.stripe.com/pay/test" };
    service.createIntent.mockResolvedValue(mockResult);
    const shipping = {
      name: "Ada Lovelace",
      line1: "12 Baker St",
      city: "Provo",
      state: "UT",
      zip: "84604",
      country: "US",
    };

    await handler.createIntent({
      orderId: "order-uuid-1",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
      shipping,
    });

    expect(service.createIntent).toHaveBeenCalledWith(
      "order-uuid-1",
      "https://example.com/success",
      "https://example.com/cancel",
      undefined,
      null,
      shipping,
    );
  });
});
