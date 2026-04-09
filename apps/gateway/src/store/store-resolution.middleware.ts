import { Injectable, NestMiddleware, NotFoundException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import { StoreService } from "./store.service";

@Injectable()
export class StoreResolutionMiddleware implements NestMiddleware {
  constructor(private readonly storeService: StoreService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Admin routes resolve the store via AdminStoreGuard (token-based) — skip middleware.
    // Note: req.path strips the version prefix in NestJS/Express 5 context, so use originalUrl.
    if (req.originalUrl?.includes("/admin/")) return next();

    // 1. Explicit store slug header — highest priority, set by storefront clients
    //    via NEXT_PUBLIC_STORE_SLUG. Deterministic: no hostname magic required.
    const slugHeader = req.headers["x-store-slug"] as string | undefined;
    let store = slugHeader ? await this.storeService.findBySlug(slugHeader) : null;

    // 2. Try Host header (custom domains)
    if (!store) store = await this.storeService.findByDomain(req.hostname);

    // 3. Fall back to :slug route param
    const slug = req.params["slug"] as string | undefined;
    if (!store && slug) {
      store = await this.storeService.findBySlug(slug);
    }

    // 4. Fall back to clientId decoded from the Bearer token
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
