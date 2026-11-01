import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

// Locally, read .env.local; CI and Vercel provide real environment variables instead.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations use the direct (unpooled) connection.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? "" },
  strict: true,
});
