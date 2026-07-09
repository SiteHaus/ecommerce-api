import { validateWorkerEnv } from "./env";

const base = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "noreply@example.com",
  STRIPE_SECRET_KEY: "sk_test_123",
};

describe("validateWorkerEnv", () => {
  it("retains STRIPE_SECRET_KEY (required at boot by ReturnRefundProcessor)", () => {
    const env = validateWorkerEnv(base);
    expect((env as Record<string, unknown>).STRIPE_SECRET_KEY).toBe("sk_test_123");
  });

  it("throws a clear error when STRIPE_SECRET_KEY is missing", () => {
    const { STRIPE_SECRET_KEY: _omit, ...without } = base;
    expect(() => validateWorkerEnv(without)).toThrow(/STRIPE_SECRET_KEY/);
  });
});
