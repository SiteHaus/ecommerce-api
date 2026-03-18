import { Injectable } from "@nestjs/common";
import { Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import { nanoid } from "zod";

@Injectable()
export class AnonSessionService {
  async getOrCreate(req: Request, res: Response): Promise<string> {
    if (req.cookies["store_session"]) {
      const token = req.cookies["store_session"];

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.SESSION_SECRET!) as {
            sub: string;
          };
          return decoded.sub;
        } catch {
          // invalid or expired, fall through to create new
        }
      }
    }

    const sub = nanoid() as unknown as string;
    const newToken = jwt.sign({ sub }, process.env.SESSION_SECRET!);
    res.cookie("store_session", newToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: process.env.NODE_ENV === "production",
    });
    return sub;
  }
}
