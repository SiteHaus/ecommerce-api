import { Module } from "@nestjs/common";
import { AnonSessionService } from "./anon-session.service";

@Module({
  providers: [AnonSessionService],
  exports: [AnonSessionService],
})
export class AnonSessionModule {}
