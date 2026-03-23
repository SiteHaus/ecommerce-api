import { Module } from "@nestjs/common";
import { ConnectHandler } from "./connect.handler";
import { ConnectService } from "./connect.service";

@Module({
  providers: [ConnectService, ConnectHandler],
})
export class ConnectModule {}
