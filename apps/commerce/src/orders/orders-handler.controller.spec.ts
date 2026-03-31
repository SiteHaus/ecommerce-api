import { Test, TestingModule } from "@nestjs/testing";
import { OrdersHandlerController } from "./orders-handler.controller";
import { OrdersHandlerService } from "./orders-handler.service";

describe("OrdersHandlerController", () => {
  let controller: OrdersHandlerController;
  let service: {
    getForCustomer: jest.Mock;
    listForCustomer: jest.Mock;
    adminGet: jest.Mock;
    adminList: jest.Mock;
    ship: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getForCustomer: jest.fn(),
      listForCustomer: jest.fn(),
      adminGet: jest.fn(),
      adminList: jest.fn(),
      ship: jest.fn(),
    };

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

  it("delegates adminGet with storeId and orderId", async () => {
    service.adminGet.mockResolvedValue({ id: "order-1" });
    const payload = { storeId: "store-1", orderId: "order-1" };

    await controller.adminGet(payload);

    expect(service.adminGet).toHaveBeenCalledWith(payload);
  });

  it("delegates adminList with full payload", async () => {
    service.adminList.mockResolvedValue({ items: [], total: 0 });
    const payload = {
      storeId: "store-1",
      status: ["confirmed"],
      email: "test@example.com",
      limit: 20,
      offset: 0,
      sort: "newest" as const,
    };

    await controller.adminList(payload);

    expect(service.adminList).toHaveBeenCalledWith(payload);
  });

  it("delegates ship with storeId, orderId, and trackingNumber", async () => {
    service.ship.mockResolvedValue({ id: "order-1", status: "shipped" });
    const payload = { storeId: "store-1", orderId: "order-1", trackingNumber: "1Z999AA1" };

    await controller.ship(payload);

    expect(service.ship).toHaveBeenCalledWith(payload);
  });
});
