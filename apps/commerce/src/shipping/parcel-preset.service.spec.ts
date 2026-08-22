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

  it("returns a message on delete rather than resolving undefined", async () => {
    const where = jest.fn().mockResolvedValue(undefined);
    const db = { delete: jest.fn().mockReturnValue({ where }) };
    const service = new ParcelPresetService(db as any);

    const result = await service.delete("store-1", "p1");

    expect(where).toHaveBeenCalled();
    // A handler resolving undefined never emits, so the gateway's firstValueFrom
    // throws EmptyError and a successful delete surfaces as a failure toast.
    // Matches deleteZone/deleteRate's `{ message }` convention.
    expect(result).toEqual({ message: "Preset deleted." });
  });
});
