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
