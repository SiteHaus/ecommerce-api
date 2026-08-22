import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { PostageLedgerService } from "./postage-ledger.service";

@Controller()
export class PostageLedgerHandler {
  constructor(private readonly ledger: PostageLedgerService) {}

  @MessagePattern("shipping.getPostageBalance")
  getBalance(@Payload() data: { storeId: string }) {
    return this.ledger.getBalance(data.storeId);
  }

  @MessagePattern("shipping.listLedger")
  listEntries(@Payload() data: { storeId: string }) {
    return this.ledger.listEntries(data.storeId);
  }
}
