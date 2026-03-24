import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { AnonSessionService } from "./anon-session.service";

@Injectable()
export class AnonSessionMiddleware implements NestMiddleware {
  constructor(private readonly anonSession: AnonSessionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const sub = await this.anonSession.getOrCreate(req, res);
    (req as any).anonSession = { sub };
    next();
  }
}
