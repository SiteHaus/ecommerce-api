import type { Db } from "@sitehaus-ecom/database";
import type { EmailService } from "@sitehaus-ecom/shared";
import type { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

export interface HandlerContext {
  db: Db;
  email: EmailService;
  logger: Logger;
}

export type Handler = (job: Job, ctx: HandlerContext) => Promise<void>;
