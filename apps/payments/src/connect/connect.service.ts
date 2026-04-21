import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import { eq, storesTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import Stripe from "stripe";

@Injectable()
export class ConnectService {
  private readonly logger = new Logger(ConnectService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    @Inject(DB_TOKEN) private readonly db: Db,
  ) {
    this.stripe = new Stripe(config.getOrThrow("STRIPE_SECRET_KEY"));
  }

  async syncAccount(
    storeId: string,
    accountId: string,
  ): Promise<{
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      const patch = {
        stripeChargesEnabled: account.charges_enabled ?? false,
        stripePayoutsEnabled: account.payouts_enabled ?? false,
        stripeDetailsSubmitted: account.details_submitted ?? false,
        updatedAt: new Date(),
      };
      await this.db.update(storesTable).set(patch).where(eq(storesTable.id, storeId));
      return {
        chargesEnabled: patch.stripeChargesEnabled,
        payoutsEnabled: patch.stripePayoutsEnabled,
        detailsSubmitted: patch.stripeDetailsSubmitted,
      };
    } catch (err: any) {
      this.logger.error(`Stripe account sync failed for store ${storeId}: ${err.message}`);
      return { chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
    }
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
      this.logger.error(`Stripe connect failed for store ${storeId}: ${err.message}`);
      throw new RpcException({ status: 500, message: "Stripe error" });
    }
  }
}
