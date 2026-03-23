import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import { eq, storesTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import Stripe from "stripe";

@Injectable()
export class ConnectService {
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    @Inject(DB_TOKEN) private readonly db: Db,
  ) {
    this.stripe = new Stripe(config.getOrThrow("STRIPE_SECRET_KEY"));
  }

  async initiateConnect(
    storeId: string,
    existingAccountId: string | null,
    returnUrl: string,
  ): Promise<{ url: string }> {
    try {
      let accountId = existingAccountId;

      if (!accountId) {
        const account = await this.stripe.accounts.create({ type: "express" });
        accountId = account.id;
        await this.db
          .update(storesTable)
          .set({ stripeAccountId: accountId })
          .where(eq(storesTable.id, storeId));
      }

      const link = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: returnUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      });

      return { url: link.url };
    } catch (err: any) {
      throw new RpcException({
        status: 500,
        message: err.message ?? "Stripe error",
      });
    }
  }
}
