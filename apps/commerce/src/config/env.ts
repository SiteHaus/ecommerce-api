import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  DATABASE_URL: z.url(),

  // Optional: cap the pg connection pool per instance. Under high concurrency
  // with many store tenants, tune this alongside Postgres max_connections.
  DB_POOL_SIZE: z.coerce.number().int().positive().default(10),

  // Cloudflare R2 — product image storage
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_CDN_URL: z.url(),

  // Transactional email via Resend
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.email(),
});

export type Env = z.infer<typeof envSchema>;

export function validateCommerceEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }
  return result.data;
}
