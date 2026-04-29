import { Controller, Inject, Req, UseGuards } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@sitehaus-ecom/contracts";
import { AdminStoreGuard } from "../store/admin-store.guard";
import { CommercePerm } from "../store/commerce-perm.decorator";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Controller()
export class CustomersController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @CommercePerm("customers:read")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.customer.listCustomers)
  listCustomers(@Req() req: Request) {
    return tsRestHandler(contract.customer.listCustomers, async ({ query }) => {
      const result = await firstValueFrom(
        this.commerce.send("customers.list", { ...query, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("customers:read")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.customer.getCustomer)
  getCustomer(@Req() req: Request) {
    return tsRestHandler(contract.customer.getCustomer, async ({ params }) => {
      const result = await firstValueFrom(
        this.commerce.send("customers.get", { id: params.id, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @CommercePerm("customers:write")
  @UseGuards(AdminStoreGuard)
  @TsRestHandler(contract.customer.updateCustomer)
  updateCustomer(@Req() req: Request) {
    return tsRestHandler(contract.customer.updateCustomer, async ({ params, body }) => {
      const result = await firstValueFrom(
        this.commerce.send("customers.update", { ...body, id: params.id, storeId: req.store!.id }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.customer.myProfile)
  myProfile(@Req() req: Request) {
    return tsRestHandler(contract.customer.myProfile, async () => {
      const result = await firstValueFrom(
        this.commerce.send("customers.myProfile", {
          storeId: req.store!.id,
          userId: req.user!.userId,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.customer.myOrders)
  myOrders(@Req() req: Request) {
    return tsRestHandler(contract.customer.myOrders, async () => {
      const result = await firstValueFrom(
        this.commerce.send("customers.myOrders", {
          storeId: req.store!.id,
          userId: req.user!.userId,
        }),
      );
      return { status: 200 as const, body: result };
    });
  }
}
