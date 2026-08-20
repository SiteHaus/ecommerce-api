import { Test, TestingModule } from "@nestjs/testing";
import { ConnectHandler } from "./connect.handler";
import { ConnectService } from "./connect.service";

describe("ConnectHandler", () => {
  let handler: ConnectHandler;
  let mockConnectService: { initiateConnect: jest.Mock };

  beforeEach(async () => {
    mockConnectService = { initiateConnect: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConnectHandler],
      providers: [{ provide: ConnectService, useValue: mockConnectService }],
    }).compile();

    handler = module.get(ConnectHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("delegates to ConnectService with correct positional args", async () => {
    const expected = { url: "https://connect.stripe.com/setup/e/abc" };
    mockConnectService.initiateConnect.mockResolvedValue(expected);

    await handler.initiateConnect({
      storeId: "store-1",
      stripeAccountId: "acct_123",
      detailsSubmitted: false,
      returnUrl: "https://example.com/return",
    });

    expect(mockConnectService.initiateConnect).toHaveBeenCalledWith(
      "store-1",
      "acct_123",
      false,
      "https://example.com/return",
    );
  });

  it("passes null stripeAccountId through correctly", async () => {
    mockConnectService.initiateConnect.mockResolvedValue({
      url: "https://...",
    });

    await handler.initiateConnect({
      storeId: "store-1",
      stripeAccountId: null,
      detailsSubmitted: false,
      returnUrl: "https://example.com/return",
    });

    expect(mockConnectService.initiateConnect).toHaveBeenCalledWith(
      "store-1",
      null,
      false,
      "https://example.com/return",
    );
  });

  it("passes detailsSubmitted through correctly", async () => {
    mockConnectService.initiateConnect.mockResolvedValue({
      url: "https://connect.stripe.com/express/abc",
    });

    await handler.initiateConnect({
      storeId: "store-1",
      stripeAccountId: "acct_123",
      detailsSubmitted: true,
      returnUrl: "https://example.com/return",
    });

    expect(mockConnectService.initiateConnect).toHaveBeenCalledWith(
      "store-1",
      "acct_123",
      true,
      "https://example.com/return",
    );
  });

  it("returns the service result without transformation", async () => {
    const expected = { url: "https://connect.stripe.com/setup/e/xyz" };
    mockConnectService.initiateConnect.mockResolvedValue(expected);

    const result = await handler.initiateConnect({
      storeId: "store-1",
      stripeAccountId: null,
      detailsSubmitted: false,
      returnUrl: "https://example.com/return",
    });

    expect(result).toBe(expected);
  });
});
