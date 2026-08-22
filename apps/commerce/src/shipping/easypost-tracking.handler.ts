import { Controller } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { EasypostTrackingService, type EasypostTrackingEvent } from "./easypost-tracking.service";

@Controller()
export class EasypostTrackingHandler {
  constructor(private readonly tracking: EasypostTrackingService) {}

  @EventPattern("commerce.easypost.tracking")
  handle(@Payload() event: EasypostTrackingEvent) {
    return this.tracking.handle(event);
  }
}
