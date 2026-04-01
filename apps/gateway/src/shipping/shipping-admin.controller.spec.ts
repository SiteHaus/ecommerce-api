import { Test, TestingModule } from "@nestjs/testing";
import { ShippingAdminController } from "./shipping-admin.controller";

describe("ShippingAdminController", () => {
  let controller: ShippingAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShippingAdminController],
    }).compile();

    controller = module.get<ShippingAdminController>(ShippingAdminController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
