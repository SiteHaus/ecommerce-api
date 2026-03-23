import { Injectable, NestMiddleware, NotFoundException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
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

    if (!store) throw new NotFoundException("Store not found");

    req.store = store;
    next();
  }
}
