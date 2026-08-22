import { OriginAddressService } from "./origin-address.service";

describe("OriginAddressService", () => {
  it("returns null fields when nothing is set yet", async () => {
    const db = {
      query: {
        storesTable: {
          findFirst: jest.fn().mockResolvedValue({ originName: null, originLine1: null }),
        },
      },
    };
    const service = new OriginAddressService(db as any);

    const result = await service.get("store-1");

    expect(result.originName).toBeNull();
  });

  it("writes the origin address columns", async () => {
    const db = {
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }),
      }),
    };
    const service = new OriginAddressService(db as any);

    await service.set("store-1", {
      originName: "Camo Merch",
      originLine1: "2 Warehouse Rd",
      originLine2: null,
      originCity: "Provo",
      originState: "UT",
      originZip: "84601",
      originCountry: "US",
    });

    expect(db.update).toHaveBeenCalled();
  });
});
