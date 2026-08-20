import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import { ConnectService } from "./connect.service";

jest.mock("stripe");
import Stripe from "stripe";

const MockedStripe = Stripe as jest.MockedClass<typeof Stripe>;

const FAKE_STORE_ID = "store-uuid-123";
const FAKE_ACCOUNT_ID = "acct_test_123";
const FAKE_RETURN_URL = "https://example.com/return";
const FAKE_ONBOARDING_URL = "https://connect.stripe.com/setup/e/abc123";
const FAKE_LOGIN_URL = "https://connect.stripe.com/express/abc123";

describe("ConnectService", () => {
  let service: ConnectService;
  let mockAccountsCreate: jest.Mock;
  let mockAccountLinksCreate: jest.Mock;
  let mockCreateLoginLink: jest.Mock;
  let mockWhere: jest.Mock;
  let mockSet: jest.Mock;
  let mockUpdate: jest.Mock;

  beforeEach(async () => {
    mockAccountsCreate = jest.fn();
    mockAccountLinksCreate = jest.fn();
    mockCreateLoginLink = jest.fn();

    MockedStripe.mockImplementation(
      () =>
        ({
          accounts: { create: mockAccountsCreate, createLoginLink: mockCreateLoginLink },
          accountLinks: { create: mockAccountLinksCreate },
        }) as any,
    );

    mockWhere = jest.fn().mockResolvedValue([]);
    mockSet = jest.fn().mockReturnValue({ where: mockWhere });
    mockUpdate = jest.fn().mockReturnValue({ set: mockSet });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => "sk_test_fake" },
        },
        { provide: DB_TOKEN, useValue: { update: mockUpdate } },
      ],
    }).compile();

    service = module.get(ConnectService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initiateConnect — no existing account", () => {
    it("creates a new Express account and saves it to the DB", async () => {
      mockAccountsCreate.mockResolvedValue({ id: FAKE_ACCOUNT_ID });
      mockAccountLinksCreate.mockResolvedValue({ url: FAKE_ONBOARDING_URL });

      await service.initiateConnect(FAKE_STORE_ID, null, false, FAKE_RETURN_URL);

      expect(mockAccountsCreate).toHaveBeenCalledWith({ type: "express" });
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith({ stripeAccountId: FAKE_ACCOUNT_ID });
    });

    it("creates an account link with the new accountId and returns the url", async () => {
      mockAccountsCreate.mockResolvedValue({ id: FAKE_ACCOUNT_ID });
      mockAccountLinksCreate.mockResolvedValue({ url: FAKE_ONBOARDING_URL });

      const result = await service.initiateConnect(FAKE_STORE_ID, null, false, FAKE_RETURN_URL);

      expect(result).toEqual({ url: FAKE_ONBOARDING_URL });
    });

    it("always onboards a brand-new account even if detailsSubmitted is somehow true", async () => {
      mockAccountsCreate.mockResolvedValue({ id: FAKE_ACCOUNT_ID });
      mockAccountLinksCreate.mockResolvedValue({ url: FAKE_ONBOARDING_URL });

      await service.initiateConnect(FAKE_STORE_ID, null, true, FAKE_RETURN_URL);

      expect(mockCreateLoginLink).not.toHaveBeenCalled();
      expect(mockAccountLinksCreate).toHaveBeenCalled();
    });
  });

  describe("initiateConnect — existing account, onboarding incomplete", () => {
    it("skips account creation and DB write, reuses existing accountId", async () => {
      mockAccountLinksCreate.mockResolvedValue({ url: FAKE_ONBOARDING_URL });

      await service.initiateConnect(FAKE_STORE_ID, FAKE_ACCOUNT_ID, false, FAKE_RETURN_URL);

      expect(mockAccountsCreate).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("creates an account link with the existing accountId and returns the url", async () => {
      mockAccountLinksCreate.mockResolvedValue({ url: FAKE_ONBOARDING_URL });

      const result = await service.initiateConnect(
        FAKE_STORE_ID,
        FAKE_ACCOUNT_ID,
        false,
        FAKE_RETURN_URL,
      );

      expect(result).toEqual({ url: FAKE_ONBOARDING_URL });
    });
  });

  describe("initiateConnect — existing account, already onboarded (SIT-259)", () => {
    it("returns a real Express dashboard login link instead of re-running onboarding", async () => {
      mockCreateLoginLink.mockResolvedValue({ url: FAKE_LOGIN_URL });

      const result = await service.initiateConnect(
        FAKE_STORE_ID,
        FAKE_ACCOUNT_ID,
        true,
        FAKE_RETURN_URL,
      );

      expect(mockCreateLoginLink).toHaveBeenCalledWith(FAKE_ACCOUNT_ID);
      expect(mockAccountLinksCreate).not.toHaveBeenCalled();
      expect(result).toEqual({ url: FAKE_LOGIN_URL });
    });

    it("wraps a login link failure in RpcException", async () => {
      mockCreateLoginLink.mockRejectedValue(new Error("account not fully onboarded"));

      await expect(
        service.initiateConnect(FAKE_STORE_ID, FAKE_ACCOUNT_ID, true, FAKE_RETURN_URL),
      ).rejects.toBeInstanceOf(RpcException);
    });
  });

  describe("account link params", () => {
    it("sets refresh_url and return_url to returnUrl, type to account_onboarding", async () => {
      mockAccountsCreate.mockResolvedValue({ id: FAKE_ACCOUNT_ID });
      mockAccountLinksCreate.mockResolvedValue({ url: FAKE_ONBOARDING_URL });

      await service.initiateConnect(FAKE_STORE_ID, null, false, FAKE_RETURN_URL);

      expect(mockAccountLinksCreate).toHaveBeenCalledWith({
        account: FAKE_ACCOUNT_ID,
        refresh_url: FAKE_RETURN_URL,
        return_url: FAKE_RETURN_URL,
        type: "account_onboarding",
      });
    });
  });

  describe("error handling", () => {
    it("wraps errors in RpcException with status 500", async () => {
      mockAccountsCreate.mockRejectedValue(new Error("card_error"));

      await expect(
        service.initiateConnect(FAKE_STORE_ID, null, false, FAKE_RETURN_URL),
      ).rejects.toBeInstanceOf(RpcException);
    });

    it("when accounts.create throws, does not call accountLinks.create or update DB", async () => {
      mockAccountsCreate.mockRejectedValue(new Error("stripe down"));

      await expect(
        service.initiateConnect(FAKE_STORE_ID, null, false, FAKE_RETURN_URL),
      ).rejects.toBeInstanceOf(RpcException);

      expect(mockAccountLinksCreate).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("when accountLinks.create throws, wraps in RpcException", async () => {
      mockAccountsCreate.mockResolvedValue({ id: FAKE_ACCOUNT_ID });
      mockAccountLinksCreate.mockRejectedValue(new Error("link failed"));

      await expect(
        service.initiateConnect(FAKE_STORE_ID, null, false, FAKE_RETURN_URL),
      ).rejects.toBeInstanceOf(RpcException);
    });

    it("uses 'Stripe error' as fallback when error has no message", async () => {
      mockAccountsCreate.mockRejectedValue({});

      let caught: RpcException | undefined;
      try {
        await service.initiateConnect(FAKE_STORE_ID, null, false, FAKE_RETURN_URL);
      } catch (e) {
        caught = e as RpcException;
      }

      expect(caught).toBeInstanceOf(RpcException);
      const error = caught!.getError() as { status: number; message: string };
      expect(error.message).toBe("Stripe error");
    });

    it("when DB write throws after account creation, wraps in RpcException (account orphaned)", async () => {
      mockAccountsCreate.mockResolvedValue({ id: FAKE_ACCOUNT_ID });
      mockWhere.mockRejectedValue(new Error("db connection lost"));

      await expect(
        service.initiateConnect(FAKE_STORE_ID, null, false, FAKE_RETURN_URL),
      ).rejects.toBeInstanceOf(RpcException);

      // accountLinks.create is never reached since DB write comes first
      expect(mockAccountLinksCreate).not.toHaveBeenCalled();
    });

    it("returns generic error message regardless of underlying Stripe error", async () => {
      mockAccountLinksCreate.mockRejectedValue(
        new Error("Your platform account must complete its Stripe onboarding"),
      );

      let caught: RpcException | undefined;
      try {
        await service.initiateConnect(FAKE_STORE_ID, FAKE_ACCOUNT_ID, false, FAKE_RETURN_URL);
      } catch (e) {
        caught = e as RpcException;
      }

      const error = caught!.getError() as { status: number; message: string };
      expect(error.status).toBe(500);
      expect(error.message).toBe("Stripe error");
    });
  });
});
