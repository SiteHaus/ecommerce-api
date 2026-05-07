import { Controller, Inject, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ClientProxy } from "@nestjs/microservices";
import { contract } from "@sitehaus-ecom/contracts";
import { Public } from "@sitehaus/client-sdk/nestjs";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Public()
@Controller()
export class AnalyticsController {
  constructor(@Inject("COMMERCE_SERVICE") private readonly commerce: ClientProxy) {}

  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @TsRestHandler(contract.analytics.trackEvent)
  trackEvent(@Req() req: Request) {
    return tsRestHandler(contract.analytics.trackEvent, async ({ body }) => {
      const sessionId = (req as any).anonSession?.sub as string | undefined;
      const userId = req.user?.userId;

      await firstValueFrom(
        this.commerce.send("analytics.trackEvent", {
          storeId: req.store!.id,
          sessionId,
          userId,
          ...body,
        }),
      );

      return { status: 204 as const, body: {} };
    });
  }
}
