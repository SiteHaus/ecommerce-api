import { Test } from "@nestjs/testing";
import { EasypostWebhookController } from "./easypost-webhook.controller";

describe("EasypostWebhookController", () => {
  it("emits the tracking event and returns 200 immediately", async () => {
    const commerce = { emit: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [EasypostWebhookController],
      providers: [{ provide: "COMMERCE_SERVICE", useValue: commerce }],
    }).compile();

    const controller = moduleRef.get(EasypostWebhookController);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const req = {
      body: { result: { id: "trk_1", tracking_code: "9400", status: "in_transit" } },
    } as any;

    controller.webhook(req, res);

    expect(commerce.emit).toHaveBeenCalledWith(
      "commerce.easypost.tracking",
      expect.objectContaining({ trackingCode: "9400", status: "in_transit" }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
