import { Test, TestingModule } from "@nestjs/testing";
import { CheckoutHandler } from "./checkout.handler";
import { CheckoutService } from "./checkout.service";

const mockResult = {
  orderId: "order-uuid-1",
  subtotalCents: 2000,
  shippingCents: 0,
  totalCents: 2000,
  currency: "usd",
};

describe("CheckoutHandler", () => {
  let handler: CheckoutHandler;
  let service: jest.Mocked<CheckoutService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckoutHandler],
      providers: [{ provide: CheckoutService, useValue: { createOrder: jest.fn() } }],
    }).compile();

    handler = module.get(CheckoutHandler);
    service = module.get(CheckoutService) as jest.Mocked<CheckoutService>;
  });

  it("delegates createOrder to the service", async () => {
    service.createOrder.mockResolvedValue(mockResult);

    const payload = {
      storeId: "store-1",
      sessionToken: "tok",
      email: "test@example.com",
      shippingName: "John",
      shippingLine1: "123 Main",
      shippingCity: "Vancouver",
      shippingState: "BC",
      shippingZip: "V5K 0A1",
      shippingCountry: "CA",
    };

    const result = await handler.createOrder(payload);
    expect(result).toEqual(mockResult);
    expect(service.createOrder).toHaveBeenCalledWith(payload);
  });
});
