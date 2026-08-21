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
