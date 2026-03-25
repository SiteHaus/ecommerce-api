import { Injectable } from "@nestjs/common";
import { UserContext } from "@sitehaus-ecom/auth";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Request } from "express";

/**
 * Throttles by userId → anonymous session token → IP.
 * More specific identifiers get priority so authenticated users
 * aren't penalised for sharing an IP with others.
 */
@Injectable()
export class SmartThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const authed = (req as any).user as UserContext | undefined;
    if (authed?.userId) return `user:${authed.userId}`;

    const session = (req as any).anonSession as { sub?: string } | undefined;
    if (session?.sub) return `session:${session.sub}`;

    return req.ip ?? "unknown";
  }
}
