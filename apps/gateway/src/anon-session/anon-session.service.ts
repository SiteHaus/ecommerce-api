import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import * as jwt from "jsonwebtoken";

@Injectable()
export class AnonSessionService {
  constructor(private readonly config: ConfigService) {}

  async getOrCreate(req: Request, res: Response): Promise<string> {
    const secret = this.config.getOrThrow<string>("SESSION_SECRET");

    if (req.cookies["store_session"]) {
      const token = req.cookies["store_session"];

      if (token) {
        try {
          const decoded = jwt.verify(token, secret) as { sub: string };
          return decoded.sub;
        } catch {
          // invalid or expired, fall through to create new
        }
      }
    }

    const sub = randomUUID();
    const newToken = jwt.sign({ sub }, secret, { expiresIn: "7d" });
    res.cookie("store_session", newToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: this.config.get("NODE_ENV") === "production",
    });
    return sub;
  }
}
