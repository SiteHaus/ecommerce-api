import { config } from "dotenv";
import { resolve } from "path";
import { defineConfig } from "drizzle-kit";

// Load from monorepo root so DATABASE_URL only lives in one place
// eslint-disable-next-line no-undef
config({ path: resolve(__dirname, "../../.env") });

export default defineConfig({
  schema: "./dist/tables.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
