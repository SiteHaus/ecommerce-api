import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(7020),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),

  // SiteHaus IAM — for @sitehaus/client-sdk/nestjs
  IAM_URL: z.url(),
  IAM_CLIENT_KEY: z.string().min(1),

  // Session tokens for anonymous cart guests
  SESSION_SECRET: z.string().min(32),

  // TCP service hosts
  COMMERCE_HOST: z.string().default("localhost"),
  PAYMENTS_HOST: z.string().default("localhost"),

  // CORS allow-list. Static origins (admin UI + known storefronts), comma-
  // separated. Active store domains are additionally allowed at request time.
  CORS_ALLOWED_ORIGINS: z.string().default(""),
  // When false, disallowed origins are logged but still permitted (soak mode);
  // flip to "true" to enforce rejection after observing real traffic.
  CORS_ENFORCE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }
  return result.data;
}
