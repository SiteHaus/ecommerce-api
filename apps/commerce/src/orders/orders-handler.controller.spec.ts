import { Test, TestingModule } from "@nestjs/testing";
import { OrdersHandlerController } from "./orders-handler.controller";
import { OrdersHandlerService } from "./orders-handler.service";

describe("OrdersHandlerController", () => {
  let controller: OrdersHandlerController;
  let service: { getForCustomer: jest.Mock; listForCustomer: jest.Mock };

  beforeEach(async () => {
    service = { getForCustomer: jest.fn(), listForCustomer: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersHandlerController],
      providers: [{ provide: OrdersHandlerService, useValue: service }],
    }).compile();

    controller = module.get(OrdersHandlerController);
  });

  it("delegates getForCustomer with full payload", async () => {
    service.getForCustomer.mockResolvedValue({ id: "order-1" });
    const payload = { storeId: "store-1", orderId: "order-1", userId: "user-1" };

    await controller.getForCustomer(payload);

    expect(service.getForCustomer).toHaveBeenCalledWith(payload);
  });

  it("delegates listForCustomer with full payload", async () => {
    service.listForCustomer.mockResolvedValue({ items: [], total: 0 });
    const payload = { storeId: "store-1", userId: "user-1", limit: 10, offset: 0 };

    await controller.listForCustomer(payload);

    expect(service.listForCustomer).toHaveBeenCalledWith(payload);
  });
});
