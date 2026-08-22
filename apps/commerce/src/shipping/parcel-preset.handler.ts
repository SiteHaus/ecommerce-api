import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ParcelPresetService } from "./parcel-preset.service";

@Controller()
export class ParcelPresetHandler {
  constructor(private readonly presets: ParcelPresetService) {}

  @MessagePattern("shipping.listPresets")
  list(@Payload() data: { storeId: string }) {
    return this.presets.list(data.storeId);
  }

  @MessagePattern("shipping.createPreset")
  create(
    @Payload()
    data: {
      storeId: string;
      name: string;
      lengthIn: number;
      widthIn: number;
      heightIn: number;
    },
  ) {
    return this.presets.create(data.storeId, data);
  }

  @MessagePattern("shipping.deletePreset")
  delete(@Payload() data: { storeId: string; presetId: string }) {
    return this.presets.delete(data.storeId, data.presetId);
  }
}
