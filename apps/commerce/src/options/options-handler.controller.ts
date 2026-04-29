import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import type {
  CreateOptionDto,
  CreateOptionValueDto,
  UpdateOptionDto,
  UpdateOptionValueDto,
} from "@sitehaus-ecom/validation";
import { OptionsHandlerService } from "./options-handler.service";

@Controller()
export class OptionsHandlerController {
  constructor(private readonly options: OptionsHandlerService) {}

  @MessagePattern("catalog.options.create")
  createOption(@Payload() data: CreateOptionDto & { productId: string; storeId: string }) {
    return this.options.createOption(data);
  }

  @MessagePattern("catalog.options.update")
  updateOption(@Payload() data: UpdateOptionDto & { optionId: string; storeId: string }) {
    return this.options.updateOption(data);
  }

  @MessagePattern("catalog.options.delete")
  deleteOption(@Payload() data: { optionId: string; storeId: string }) {
    return this.options.deleteOption(data);
  }

  @MessagePattern("catalog.options.values.create")
  createOptionValue(@Payload() data: CreateOptionValueDto & { optionId: string; storeId: string }) {
    return this.options.createOptionValue(data);
  }

  @MessagePattern("catalog.options.values.update")
  updateOptionValue(@Payload() data: UpdateOptionValueDto & { valueId: string; storeId: string }) {
    return this.options.updateOptionValue(data);
  }

  @MessagePattern("catalog.options.values.delete")
  deleteOptionValue(@Payload() data: { valueId: string; storeId: string }) {
    return this.options.deleteOptionValue(data);
  }
}
