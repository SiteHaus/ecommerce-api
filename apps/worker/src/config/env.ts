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
