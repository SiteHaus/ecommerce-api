import { ParcelPresetService } from "./parcel-preset.service";

describe("ParcelPresetService", () => {
  it("lists presets scoped to the store", async () => {
    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: "p1", name: "Small box" }]),
        }),
      }),
    };
    const service = new ParcelPresetService(db as any);

    const result = await service.list("store-1");

    expect(result).toEqual([{ id: "p1", name: "Small box" }]);
  });

  it("creates a preset with the given dimensions", async () => {
    const db = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest
            .fn()
            .mockResolvedValue([
              { id: "p1", name: "Small box", lengthIn: 10, widthIn: 8, heightIn: 4 },
            ]),
        }),
      }),
    };
    const service = new ParcelPresetService(db as any);

    const result = await service.create("store-1", {
      name: "Small box",
      lengthIn: 10,
      widthIn: 8,
      heightIn: 4,
    });

    expect(result.id).toBe("p1");
  });
});
