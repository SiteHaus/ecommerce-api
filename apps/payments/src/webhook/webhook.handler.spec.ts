import { Test, TestingModule } from "@nestjs/testing";
import { WebhookHandler } from "./webhook.handler";
import { WebhookService } from "./webhook.service";

describe("WebhookHandler", () => {
  let handler: WebhookHandler;
  let service: { constructEvent: jest.Mock; handle: jest.Mock };

  beforeEach(async () => {
    service = { constructEvent: jest.fn(), handle: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookHandler],
      providers: [{ provide: WebhookService, useValue: service }],
    }).compile();

    handler = module.get(WebhookHandler);
  });

  it("decodes rawBody, calls constructEvent, and handles the event", async () => {
    const fakeEvent = { type: "checkout.session.completed" };
    service.constructEvent.mockReturnValue(fakeEvent);
    service.handle.mockResolvedValue(undefined);

    const rawBody = Buffer.from("stripe-payload").toString("base64");
    await handler.handleWebhook({ rawBody, signature: "t=123,v1=abc" });

    expect(service.constructEvent).toHaveBeenCalledWith(
      Buffer.from("stripe-payload"),
      "t=123,v1=abc",
    );
    expect(service.handle).toHaveBeenCalledWith(fakeEvent);
  });

  it("does nothing when constructEvent returns null (invalid signature)", async () => {
    service.constructEvent.mockReturnValue(null);

    await handler.handleWebhook({ rawBody: "", signature: "bad" });

    expect(service.handle).not.toHaveBeenCalled();
  });
});
