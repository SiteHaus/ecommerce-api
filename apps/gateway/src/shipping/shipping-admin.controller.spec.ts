import { Test, TestingModule } from "@nestjs/testing";
import { AdminStoreGuard } from "../store/admin-store.guard";
import { CommercePermGuard } from "../store/commerce-perm.guard";
import { ShippingAdminController } from "./shipping-admin.controller";

describe("ShippingAdminController", () => {
  let controller: ShippingAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShippingAdminController],
      providers: [{ provide: "COMMERCE_SERVICE", useValue: { send: jest.fn() } }],
    })
      .overrideGuard(AdminStoreGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CommercePermGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ShippingAdminController>(ShippingAdminController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
