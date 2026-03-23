import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ConnectService } from "./connect.service";

@Controller()
export class ConnectHandler {
  constructor(private readonly connectService: ConnectService) {}

  @MessagePattern("stripe.connect.initiate")
  initiateConnect(
    @Payload()
    payload: {
      storeId: string;
      stripeAccountId: string | null;
      returnUrl: string;
    },
  ) {
    return this.connectService.initiateConnect(
      payload.storeId,
      payload.stripeAccountId,
      payload.returnUrl,
    );
  }
}
