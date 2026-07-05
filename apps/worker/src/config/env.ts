import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  DATABASE_URL: z.url(),
  DB_POOL_SIZE: z.coerce.number().int().positive().default(5),

  // Redis — BullMQ queue backend
  REDIS_URL: z.url(),

  // Transactional email via Resend
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.email(),
  // When set, all outbound emails are redirected to this address (staging/dev only)
  EMAIL_DEV_REDIRECT: z.email().optional(),

  // Stripe — required at boot by ReturnRefundProcessor (refunds)
  STRIPE_SECRET_KEY: z.string().min(1),

  // Lighthaus liveness heartbeat (both optional — pusher stays off without them).
  // URL is the ingest endpoint, e.g. https://lighthaus-api.sitehaus.dev/heartbeat
  LIGHTHAUS_HEARTBEAT_URL: z.url().optional(),
  // Must match HEARTBEAT_SECRET configured on lighthaus-api.
  LIGHTHAUS_HEARTBEAT_SECRET: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateWorkerEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }
  return result.data;
}
