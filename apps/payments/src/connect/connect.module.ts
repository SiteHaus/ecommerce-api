import { Module } from "@nestjs/common";
import { ConnectHandler } from "./connect.handler";
import { ConnectService } from "./connect.service";

@Module({
  controllers: [ConnectHandler],
  providers: [ConnectService],
})
export class ConnectModule {}
