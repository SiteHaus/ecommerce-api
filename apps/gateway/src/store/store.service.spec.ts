import { StoreService } from "./store.service";

const STORE_ID = "aaaaaaaa-0000-4000-8000-000000000001";

function updateChain(returning: any[]) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(returning),
      }),
    }),
  };
}

const baseRow = {
  id: STORE_ID,
  clientId: "client-1",
  slug: "test-store",
  domain: null,
  currency: "usd",
  notificationEmail: null,
  notificationPreferences: null,
  stripeAccountId: null,
  stripeChargesEnabled: false,
  stripePayoutsEnabled: false,
  stripeDetailsSubmitted: false,
  reservationTtlMinutes: 15,
  fulfillmentType: "shipping" as const,
  taxRegistrationConfirmed: false,
};

describe("StoreService.update", () => {
  let service: StoreService;
  let mockUpdate: jest.Mock;
  let mockDb: any;
  let mockRedis: any;

  beforeEach(() => {
    mockUpdate = jest.fn();
    mockDb = { update: mockUpdate };
    mockRedis = { del: jest.fn().mockResolvedValue(undefined) };
    service = new StoreService(mockDb, mockRedis);
  });

  it("includes taxRegistrationConfirmed in the SET clause when provided", async () => {
    const setSpy = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ ...baseRow, taxRegistrationConfirmed: true }]),
      }),
    });
    mockUpdate.mockReturnValue({ set: setSpy });

    await service.update(STORE_ID, "test-store", null, { taxRegistrationConfirmed: true });

    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ taxRegistrationConfirmed: true }),
    );
  });

  it("omits taxRegistrationConfirmed from the SET clause when not provided", async () => {
    const setSpy = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([baseRow]),
      }),
    });
    mockUpdate.mockReturnValue({ set: setSpy });

    await service.update(STORE_ID, "test-store", null, { fulfillmentType: "pickup" });

    expect(setSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({ taxRegistrationConfirmed: expect.anything() }),
    );
  });

  it("returns taxRegistrationConfirmed on the resolved store context", async () => {
    mockUpdate.mockReturnValue(updateChain([{ ...baseRow, taxRegistrationConfirmed: true }]));

    const result = await service.update(STORE_ID, "test-store", null, {});

    expect(result.taxRegistrationConfirmed).toBe(true);
  });
});

function selectChain(returning: any[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(returning),
      }),
    }),
  };
}

describe("StoreService.isActiveStoreOrigin", () => {
  let service: StoreService;
  let mockSelect: jest.Mock;
  let mockDb: any;
  let mockRedis: any;

  beforeEach(() => {
    mockSelect = jest.fn();
    mockDb = { select: mockSelect };
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue("OK"),
    };
    service = new StoreService(mockDb, mockRedis);
  });

  it("matches an origin whose host equals a store's bare domain", async () => {
    mockSelect.mockReturnValue(selectChain([{ ...baseRow, domain: "onehealthclinics.com" }]));

    const result = await service.isActiveStoreOrigin("https://onehealthclinics.com");

    expect(result).toBe(true);
    expect(mockRedis.get).toHaveBeenCalledWith("store:domain:onehealthclinics.com");
  });

  it("strips a www. prefix before matching, since stores.domain is stored bare", async () => {
    mockSelect.mockReturnValue(selectChain([{ ...baseRow, domain: "onehealthclinics.com" }]));

    const result = await service.isActiveStoreOrigin("https://www.onehealthclinics.com");

    expect(result).toBe(true);
    expect(mockRedis.get).toHaveBeenCalledWith("store:domain:onehealthclinics.com");
  });

  it("returns false when no store matches the (normalized) host", async () => {
    mockSelect.mockReturnValue(selectChain([]));

    const result = await service.isActiveStoreOrigin("https://www.some-random-site.com");

    expect(result).toBe(false);
  });

  it("returns false for an unparseable origin without touching the db", async () => {
    const result = await service.isActiveStoreOrigin("not-a-url");

    expect(result).toBe(false);
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
