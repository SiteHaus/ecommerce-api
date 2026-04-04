import { Injectable, NestMiddleware, NotFoundException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import { StoreService } from "./store.service";

@Injectable()
export class StoreResolutionMiddleware implements NestMiddleware {
  constructor(private readonly storeService: StoreService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // 1. Try Host header (custom domains)
    let store = await this.storeService.findByDomain(req.hostname);

    // 2. Fall back to :slug route param
    const slug = req.params["slug"] as string | undefined;
    if (!store && slug) {
      store = await this.storeService.findBySlug(slug);
    }

    // 3. Fall back to clientId decoded from the Bearer token
    //    (admin app routes — no hostname/slug context)
    //    Note: guards run AFTER middleware so req.user is not yet populated here.
    //    We decode without verifying — the AccessGuard will reject invalid tokens.
    if (!store) {
      const auth = req.headers["authorization"];
      if (auth?.startsWith("Bearer ")) {
        try {
          const payload = jwt.decode(auth.slice(7)) as { clientId?: string; aud?: string } | null;
          const clientId =
            payload?.clientId ?? (typeof payload?.aud === "string" ? payload.aud : undefined);
          if (clientId) {
            store = await this.storeService.findByClientId(clientId);
          }
        } catch {
          // malformed token — AccessGuard will handle the rejection
        }
      }
    }

    if (!store) throw new NotFoundException("Store not found");

    req.store = store;
    next();
  }
}
